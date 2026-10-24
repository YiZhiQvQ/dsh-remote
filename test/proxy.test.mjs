import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { Agent } from 'node:http'
import { createDshCookieStore, cookieExpiry } from '../host/proxy/upstream.js'
import { stripHopByHop, filterSetCookie } from '../host/proxy/server.js'

/** A stub DSH that hands out a cookie once per exchange and counts the calls. */
async function fakeDsh(handler) {
  const server = createServer(handler)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return {
    port: server.address().port,
    close: () => new Promise((resolve) => server.close(resolve)),
  }
}

test('cookieExpiry reads Max-Age, then Expires, then falls back', () => {
  const near = cookieExpiry('dsh-auth-x=1; Max-Age=60; Path=/')
  assert.ok(near > Date.now() + 50_000 && near <= Date.now() + 61_000)

  const absolute = cookieExpiry('dsh-auth-x=1; Expires=' + new Date(Date.now() + 120_000).toUTCString())
  assert.ok(absolute > Date.now() + 100_000)

  const fallback = cookieExpiry('dsh-auth-x=1')
  assert.ok(fallback > Date.now(), 'an unadorned cookie still gets a bounded lifetime')
})

test('concurrent misses share one token exchange', async () => {
  let exchanges = 0
  const dsh = await fakeDsh((request, response) => {
    exchanges += 1
    response.writeHead(302, { 'set-cookie': 'dsh-auth-host=abc; Path=/; HttpOnly; Max-Age=600' })
    response.end()
  })
  const agent = new Agent({ keepAlive: true })
  try {
    const store = createDshCookieStore({ agent })
    const target = { host: '127.0.0.1', port: dsh.port, token: 'launch-token', authority: '127.0.0.1:' + String(dsh.port) }
    const values = await Promise.all(Array.from({ length: 20 }, () => store.get(target)))
    for (const value of values) assert.equal(value, 'dsh-auth-host=abc')
    assert.equal(exchanges, 1, 'twenty concurrent readers must trigger exactly one exchange')

    await store.get(target)
    assert.equal(exchanges, 1, 'a warm cache does not re-exchange')
  } finally {
    agent.destroy()
    await dsh.close()
  }
})

test('a missing dsh-auth cookie is reported, not cached as success', async () => {
  let exchanges = 0
  const dsh = await fakeDsh((_request, response) => {
    exchanges += 1
    response.writeHead(200, { 'content-type': 'text/plain' })
    response.end('no cookie here')
  })
  const agent = new Agent({ keepAlive: true })
  try {
    let lastError = null
    const store = createDshCookieStore({ agent, onAuthError: (message) => { lastError = message } })
    const target = { host: '127.0.0.1', port: dsh.port, token: 'launch-token', authority: '127.0.0.1:' + String(dsh.port) }
    assert.equal(await store.get(target), undefined)
    assert.match(String(lastError), /no dsh-auth cookie/)
    assert.equal(store.expiryOf(target), undefined)

    await store.get(target)
    assert.equal(exchanges, 2, 'a failed exchange is not cached')
  } finally {
    agent.destroy()
    await dsh.close()
  }
})

test('invalidate forces the next read to exchange again', async () => {
  let exchanges = 0
  const dsh = await fakeDsh((_request, response) => {
    exchanges += 1
    response.writeHead(302, { 'set-cookie': 'dsh-auth-host=v' + String(exchanges) + '; Max-Age=600' })
    response.end()
  })
  const agent = new Agent({ keepAlive: true })
  try {
    const store = createDshCookieStore({ agent })
    const target = { host: '127.0.0.1', port: dsh.port, token: 't', authority: '127.0.0.1:' + String(dsh.port) }
    assert.equal(await store.get(target), 'dsh-auth-host=v1')
    store.invalidate(target)
    assert.equal(await store.get(target), 'dsh-auth-host=v2')
  } finally {
    agent.destroy()
    await dsh.close()
  }
})

test('hop-by-hop headers are stripped before forwarding', () => {
  const stripped = stripHopByHop({
    host: '10.0.0.5:3080',
    connection: 'keep-alive',
    'keep-alive': 'timeout=5',
    'transfer-encoding': 'chunked',
    te: 'trailers',
    upgrade: 'websocket',
    cookie: 'a=1',
    accept: 'text/html',
  })
  assert.equal(stripped.connection, undefined)
  assert.equal(stripped['keep-alive'], undefined)
  assert.equal(stripped['transfer-encoding'], undefined)
  assert.equal(stripped.te, undefined)
  assert.equal(stripped.upgrade, undefined)
  assert.equal(stripped.cookie, 'a=1')
  assert.equal(stripped.accept, 'text/html')
})

test('the DSH cookie never reaches the browser through set-cookie', () => {
  assert.deepEqual(filterSetCookie(['dsh-auth-host=secret; Path=/', 'theme=dark; Path=/']), ['theme=dark; Path=/'])
  assert.equal(filterSetCookie(['dsh-auth-host=secret; Path=/']), undefined)
  assert.equal(filterSetCookie('dsh-auth-a=1; Path=/'), undefined)
  assert.deepEqual(filterSetCookie(['a=1', 'b=2']), ['a=1', 'b=2'])
  assert.equal(filterSetCookie(undefined), undefined)
})
