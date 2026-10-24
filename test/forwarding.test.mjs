import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { request as httpRequest } from 'node:http'
import { startLanProxy } from '../host/proxy/server.js'

/** A DSH stand-in: hands out a cookie at `/?token=`, echoes everything else. */
async function fakeDsh() {
  const seen = []
  const server = createServer((request, response) => {
    seen.push({ url: request.url, host: request.headers.host, cookie: request.headers.cookie })
    if (request.url.startsWith('/?token=')) {
      response.writeHead(302, { 'set-cookie': 'dsh-auth-host=secret-cookie; Path=/; HttpOnly; Max-Age=600' })
      response.end()
      return
    }
    if (request.url === '/api/echo') {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ host: request.headers.host, cookie: request.headers.cookie }))
      return
    }
    response.writeHead(200, { 'content-type': 'text/html' })
    response.end('<html>dsh shell</html>')
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return { port: server.address().port, seen, close: () => new Promise((resolve) => server.close(resolve)) }
}

function raw(port, path, headers = {}) {
  return new Promise((resolve, reject) => {
    // `agent: false` keeps each probe on its own socket: a pooled socket from
    // before a pause/resume is dead, and reusing it would test the agent's
    // retry behaviour rather than the proxy's.
    const request = httpRequest({ host: '127.0.0.1', port, path, method: 'GET', headers, agent: false }, (response) => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => { body += chunk })
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body }))
    })
    request.on('error', reject)
    request.end()
  })
}

/** Log in and return the session cookie value. */
async function signIn(port) {
  const response = await new Promise((resolve, reject) => {
    const request = httpRequest({
      host: '127.0.0.1',
      port,
      path: '/__dsh_remote/login',
      method: 'POST',
      // One socket per probe: a pooled socket from before a pause/resume is dead.
      agent: false,
      headers: { 'content-type': 'application/x-www-form-urlencoded', host: '127.0.0.1:' + String(port) },
    }, (upstream) => {
      upstream.resume()
      upstream.on('end', () => resolve(upstream))
    })
    request.on('error', reject)
    request.end('username=admin&password=test-password&next=%2F')
  })
  const header = response.headers['set-cookie']
  const list = Array.isArray(header) ? header : [header]
  const session = list.find((entry) => entry && entry.startsWith('dsh-remote-session='))
  assert.ok(session, 'login must issue a session cookie')
  return session.split(';')[0]
}

async function withStack(run) {
  const dsh = await fakeDsh()
  const port = 39300 + Math.floor(Math.random() * 500)
  const proxy = startLanProxy({
    listenPort: port,
    targetHost: '127.0.0.1',
    targetPort: dsh.port,
    dshToken: 'launch-token',
    secretFile: '',
    username: 'admin',
    password: 'test-password',
    allowedHosts: ['127.0.0.1:' + String(port)],
  })
  assert.equal(await proxy.start(), true)
  try {
    await run({ proxy, port, dsh })
  } finally {
    await proxy.close()
    proxy.dispose()
    await dsh.close()
  }
}

test('a signed-in request reaches DSH with the loopback authority and the proxy cookie', async () => {
  await withStack(async ({ port, dsh }) => {
    const cookie = await signIn(port)
    const response = await raw(port, '/api/echo', { host: '127.0.0.1:' + String(port), cookie })
    assert.equal(response.status, 200)
    const body = JSON.parse(response.body)
    assert.equal(body.host, '127.0.0.1:' + String(dsh.port), 'Host is rewritten to the loopback authority')
    assert.match(String(body.cookie), /dsh-auth-host=secret-cookie/)
    assert.equal(String(body.cookie).includes('dsh-remote-session'), false, 'the LAN session cookie stays with the proxy')
  })
})

test('the DSH cookie is never handed to the browser', async () => {
  await withStack(async ({ port, dsh }) => {
    const cookie = await signIn(port)
    const response = await raw(port, '/', { host: '127.0.0.1:' + String(port), cookie })
    assert.equal(response.status, 200)
    const header = response.headers['set-cookie']
    const list = header === undefined ? [] : Array.isArray(header) ? header : [header]
    for (const entry of list) {
      assert.equal(entry.toLowerCase().includes('dsh-auth-'), false, 'no upstream auth cookie may be relayed')
    }
    assert.ok(dsh.seen.some((row) => row.url.startsWith('/?token=')), 'the token exchange happened upstream')
  })
})

test('the launch token never appears in a browser-visible response', async () => {
  await withStack(async ({ port }) => {
    const cookie = await signIn(port)
    const response = await raw(port, '/', { host: '127.0.0.1:' + String(port), cookie })
    assert.equal(response.body.includes('launch-token'), false)
  })
})

test('an unknown Host is refused before any upstream traffic', async () => {
  await withStack(async ({ port, dsh }) => {
    const before = dsh.seen.length
    const response = await raw(port, '/', { host: 'evil.example:' + String(port) })
    assert.equal(response.status, 403)
    assert.equal(dsh.seen.length, before, 'the fence must answer without contacting DSH')
  })
})

test('pause stops serving and resume restores it', async () => {
  await withStack(async ({ proxy, port }) => {
    const cookie = await signIn(port)
    assert.equal(await proxy.start(), true, 'start is idempotent while running')
    await proxy.close()
    assert.equal(proxy.state.phase, 'stopped')

    assert.equal(await proxy.start(), true)
    assert.equal(proxy.state.phase, 'running')
    const response = await raw(port, '/', { host: '127.0.0.1:' + String(port), cookie })
    assert.equal(response.status, 200)
  })
})

test('five pause/resume cycles settle in a consistent state', async () => {
  await withStack(async ({ proxy }) => {
    for (let cycle = 0; cycle < 5; cycle += 1) {
      await proxy.close()
      assert.equal(proxy.state.phase, 'stopped')
      const started = await proxy.start()
      assert.equal(started, true)
      assert.equal(proxy.state.phase, 'running')
    }
  })
})

test('a port already in use reports an error state instead of throwing', async () => {
  const blocker = createServer(() => {})
  await new Promise((resolve) => blocker.listen(0, '0.0.0.0', resolve))
  const takenPort = blocker.address().port
  const proxy = startLanProxy({
    listenPort: takenPort,
    targetPort: 52551,
    dshToken: 't',
    secretFile: '',
    username: 'admin',
    password: 'pw',
  })
  try {
    assert.equal(await proxy.start(), false)
    assert.equal(proxy.state.phase, 'error')
    assert.match(String(proxy.state.error), /EADDRINUSE/)
  } finally {
    await proxy.close()
    proxy.dispose()
    await new Promise((resolve) => blocker.close(resolve))
  }
})
