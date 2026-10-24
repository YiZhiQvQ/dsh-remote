/**
 * Session cookie signing, the launch-token secret, and the cookie helpers the
 * proxy shares with the login route.
 *
 * @module dsh-remote/host/auth/session
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { debug } from '../log.js'

const SESSION_COOKIE = 'dsh-remote-session'
const DEFAULT_SESSION_DAYS = 30

/**
 * @param {string|undefined} file
 * @returns {string}
 */
function loadSecret(file) {
  if (typeof file === 'string') {
    try {
      const value = readFileSync(file, 'utf8').trim()
      if (value.length >= 32) return value
    } catch {
      // Created below.
    }
  }
  const value = randomBytes(32).toString('hex')
  if (file) {
    try {
      mkdirSync(dirname(String(file)), { recursive: true })
      writeFileSync(String(file), value, { mode: 0o600 })
    } catch (error) {
      debug('auth', 'secret file not writable, using an in-memory secret: ' + String(error && error.code))
    }
  }
  return value
}

/**
 * @param {string} secret
 * @param {import('./credentials.js').Credentials} credentials
 * @param {number} days
 */
function createSession(secret, credentials, days = DEFAULT_SESSION_DAYS) {
  const payload = Buffer.from(JSON.stringify({
    u: credentials.username,
    v: credentials.version,
    exp: Date.now() + days * 24 * 60 * 60 * 1000,
  })).toString('base64url')
  const signature = createHmac('sha256', secret).update(payload).digest('base64url')
  return payload + '.' + signature
}

/**
 * @param {string} secret
 * @param {import('./credentials.js').Credentials} credentials
 * @param {string|undefined} value
 */
function verifySession(secret, credentials, value) {
  const parts = String(value || '').split('.')
  if (parts.length !== 2) return false
  const expected = createHmac('sha256', secret).update(parts[0]).digest()
  const actual = Buffer.from(parts[1], 'base64url')
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false
  try {
    const data = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))
    return data.u === credentials.username
      && data.v === credentials.version
      && typeof data.exp === 'number'
      && data.exp > Date.now()
  } catch {
    return false
  }
}

/** @param {string|undefined} header @param {string} name */
function cookieValue(header, name) {
  for (const segment of String(header || '').split(';')) {
    const at = segment.indexOf('=')
    if (at === -1) continue
    if (segment.slice(0, at).trim() === name) return segment.slice(at + 1).trim()
  }
  return undefined
}

/** Remove both our own session cookie and any DSH cookie the browser kept. */
function stripAuthCookies(header) {
  return String(header || '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .filter((part) => !part.startsWith(SESSION_COOKIE + '=') && !part.startsWith('dsh-auth-'))
    .join('; ')
}

function setCookie(value, days) {
  return SESSION_COOKIE + '=' + value + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + String(Math.floor(days * 24 * 60 * 60))
}

function clearCookie() {
  return SESSION_COOKIE + '=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
}

/**
 * Reject a post-login redirect that could leave this origin.
 *
 * Browsers normalise a backslash to a slash, so `/\\evil.com` resolves to
 * `http://evil.com/`. A prefix test alone is not enough: resolve the candidate
 * against a synthetic origin and require the result to stay on it.
 *
 * @param {string|null|undefined} value
 * @returns {string}
 */
function safeNext(value) {
  const fallback = '/'
  if (typeof value !== 'string' || value.length === 0) return fallback
  if (!value.startsWith('/') || value.startsWith('//')) return fallback
  if (value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) return fallback
  if (value === '/__dsh_remote' || value.startsWith('/__dsh_remote/')) return fallback
  try {
    const base = 'http://dsh-remote.invalid'
    const resolved = new URL(value, base)
    if (resolved.origin !== base) return fallback
    const next = resolved.pathname + resolved.search + resolved.hash
    // Path normalisation can still yield "//host" (from "/..//host"), which a
    // browser reads as a protocol-relative URL. Require exactly one leading slash.
    if (!next.startsWith('/') || next.startsWith('//')) return fallback
    return next
  } catch {
    return fallback
  }
}

export {
  SESSION_COOKIE,
  DEFAULT_SESSION_DAYS,
  clearCookie,
  cookieValue,
  createSession,
  loadSecret,
  safeNext,
  setCookie,
  stripAuthCookies,
  verifySession,
}
