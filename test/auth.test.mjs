import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes, scryptSync } from 'node:crypto'
import { safeNext, createSession, verifySession, stripAuthCookies } from '../host/auth/session.js'
import { loadCredentials, versionOf } from '../host/auth/credentials.js'
import { verifyPassword } from '../host/auth/password.js'
import { createRateLimiter } from '../host/auth/rate-limit.js'

test('safeNext keeps in-site paths and rejects every escape vector', () => {
  const kept = ['/a', '/a/b?c=1#d', '/api/remote/info']
  for (const value of kept) assert.equal(safeNext(value), value)

  const rejected = [
    '/\\evil.com',      // browsers normalise the backslash to a slash
    '//evil.com',
    '/..//evil.com',      // normalises to a protocol-relative reference
    'https://evil.com',
    'javascript:alert(1)',
    '/__dsh_remote/logout',
    '',
    null,
    undefined,
    '/a\u0000b',
  ]
  for (const value of rejected) assert.equal(safeNext(value), '/', 'must reject ' + JSON.stringify(value))
})

test('session cookies are bound to the credential version', () => {
  const secret = randomBytes(32).toString('hex')
  /** @type {import('../host/auth/credentials.js').Credentials} */
  const first = { username: 'admin', password: 'one', source: 'config', version: versionOf({ password: 'one' }) }
  /** @type {import('../host/auth/credentials.js').Credentials} */
  const second = { username: 'admin', password: 'two', source: 'config', version: versionOf({ password: 'two' }) }

  const cookie = createSession(secret, first, 30)
  assert.equal(verifySession(secret, first, cookie), true)
  assert.equal(verifySession(secret, second, cookie), false, 'a password change revokes the session')
  assert.equal(verifySession(randomBytes(32).toString('hex'), first, cookie), false, 'a different secret revokes the session')

  const [payload, signature] = cookie.split('.')
  const tampered = Buffer.from(JSON.stringify({ u: 'admin', v: first.version, exp: Date.now() + 60000 })).toString('base64url')
  assert.equal(verifySession(secret, first, tampered + '.' + signature), false, 'a rewritten payload fails the MAC')
  assert.equal(verifySession(secret, first, payload + '.' + signature + 'x'), false)
})

test('stripAuthCookies removes our session and every DSH cookie', () => {
  const header = 'dsh-remote-session=abc; dsh-auth-host=xyz; theme=dark; other=1'
  assert.equal(stripAuthCookies(header), 'theme=dark; other=1')
  assert.equal(stripAuthCookies(''), '')
  assert.equal(stripAuthCookies(undefined), '')
})

test('every loaded credential carries a non-empty version fingerprint', async () => {
  // An empty version makes verifySession compare '' with '' and stops binding
  // sessions to the credential entirely; a cookie minted elsewhere then fails.
  const root = await mkdtemp(join(tmpdir(), 'dsh-remote-ver-'))
  try {
    const authFile = join(root, 'auth.json')
    const salt = randomBytes(16)
    const hash = scryptSync('x', salt, 64)
    await writeFile(authFile, JSON.stringify({ username: 'admin', salt: salt.toString('hex'), hash: hash.toString('hex') }))

    const sources = [
      loadCredentials({ authFile }),
      loadCredentials({ username: 'u', password: 'p' }),
      loadCredentials({}),
    ]
    for (const credentials of sources) {
      assert.equal(typeof credentials.version, 'string')
      assert.ok(credentials.version.length >= 8, credentials.source + ' must carry a real fingerprint, got ' + JSON.stringify(credentials.version))
    }
    assert.notEqual(sources[0].version, sources[1].version, 'different secrets produce different fingerprints')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('the auth file wins over config, and a broken file falls back', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-remote-auth-'))
  try {
    const authFile = join(root, 'auth.json')
    const salt = randomBytes(16)
    const hash = scryptSync('file-secret', salt, 64)
    await writeFile(authFile, JSON.stringify({ username: 'fileadmin', salt: salt.toString('hex'), hash: hash.toString('hex') }))

    const fromFile = loadCredentials({ authFile, username: 'cfg', password: 'cfg' })
    assert.equal(fromFile.source, 'file')
    assert.equal(fromFile.username, 'fileadmin')
    assert.equal(await verifyPassword(fromFile, 'file-secret'), true)
    assert.equal(await verifyPassword(fromFile, 'wrong'), false)

    await writeFile(authFile, 'not json')
    const fallback = loadCredentials({ authFile, username: 'cfg', password: 'cfg' })
    assert.equal(fallback.source, 'config')

    assert.equal(loadCredentials({}).source, 'default')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('password comparison for the plaintext sources is constant-time and length-guarded', async () => {
  const credentials = { username: 'admin', password: 'p@ss', source: 'config', version: '' }
  assert.equal(await verifyPassword(credentials, 'p@ss'), true)
  assert.equal(await verifyPassword(credentials, 'p@ss '), false)
  assert.equal(await verifyPassword(credentials, 'p@s'), false)
})

test('the rate limiter blocks after the budget and releases after the window', () => {
  const limiter = createRateLimiter({ maxAttempts: 3, windowMs: 40, sweepMs: 100000 })
  try {
    assert.equal(limiter.isBlocked('1.2.3.4'), false)
    for (let attempt = 0; attempt < 3; attempt += 1) limiter.recordFailure('1.2.3.4')
    assert.equal(limiter.isBlocked('1.2.3.4'), true)
    assert.equal(limiter.isBlocked('5.6.7.8'), false, 'buckets are per client')

    const wait = Date.now() + 60
    while (Date.now() < wait) {
      // Busy-wait a hair past the window; the limiter is time based.
    }
    assert.equal(limiter.isBlocked('1.2.3.4'), false)
  } finally {
    limiter.stop()
  }
})

test('the rate limiter stays bounded under a flood of distinct clients', () => {
  const limiter = createRateLimiter({ maxEntries: 16, sweepMs: 100000 })
  try {
    for (let index = 0; index < 200; index += 1) limiter.recordFailure('10.0.0.' + String(index))
    assert.ok(limiter.size() <= 16, 'the map must not grow without bound, saw ' + String(limiter.size()))
  } finally {
    limiter.stop()
  }
})
