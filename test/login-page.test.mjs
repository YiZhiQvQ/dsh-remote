import test from 'node:test'
import assert from 'node:assert/strict'
import { request as httpRequest } from 'node:http'
import { startLanProxy } from '../host/proxy/server.js'

/**
 * The gate's own surfaces, exercised on a real listener so the header handling is
 * covered as it behaves rather than as a mock reports it.
 */
async function withProxy(options, run) {
  const port = 39100 + Math.floor(Math.random() * 800)
  const proxy = startLanProxy({
    listenPort: port,
    targetHost: '127.0.0.1',
    targetPort: 52551,
    dshToken: 'test-token',
    secretFile: '',
    username: 'admin',
    password: 'test-password',
    allowedHosts: ['127.0.0.1:' + String(port), '10.9.9.9:' + String(port)],
    ...options,
  })
  const started = await proxy.start()
  assert.equal(started, true)
  try {
    await run(proxy, port)
  } finally {
    await proxy.close()
    proxy.dispose()
  }
}

test('the login page is mobile-first and matches the new shell', async () => {
  await withProxy({}, async (_proxy, port) => {
    const response = await fetch('http://127.0.0.1:' + String(port) + '/__dsh_remote/login')
    assert.equal(response.status, 200)
    const html = await response.text()
    assert.match(html, /viewport-fit=cover/, 'phones need safe-area viewport support')
    assert.match(html, /远程访问/, 'the page keeps its Chinese title')
    assert.match(html, /min-height:100dvh/, 'the card centres in the dynamic viewport')
    assert.match(html, /height:50px/, 'inputs and the submit button are thumb-sized')
    assert.match(html, /prefers-color-scheme:light/, 'the page follows the system scheme')
    assert.match(html, /env\(safe-area-inset-top\)/, 'the page respects the notch')
  })
})

test('an unauthenticated HTML request is redirected, not answered with the app', async () => {
  await withProxy({}, async (_proxy, port) => {
    const response = await fetch('http://127.0.0.1:' + String(port) + '/', {
      headers: { accept: 'text/html' },
      redirect: 'manual',
    })
    assert.equal(response.status, 303)
    const location = response.headers.get('location') || ''
    assert.match(location, /^\/__dsh_remote\/login\?next=/)
  })
})

/** `fetch` refuses to set Host, so the fence test speaks raw HTTP. */
function rawGet(port, path, host) {
  return new Promise((resolve, reject) => {
    const request = httpRequest({ host: '127.0.0.1', port, path, method: 'GET', headers: { host } }, (response) => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => { body += chunk })
      response.on('end', () => resolve({ status: response.statusCode, body }))
    })
    request.on('error', reject)
    request.end()
  })
}

test('the health endpoint is not readable before the Host fence admits the caller', async () => {
  await withProxy({}, async (_proxy, port) => {
    const rejected = await rawGet(port, '/__dsh_remote/health', 'evil.example:' + String(port))
    assert.equal(rejected.status, 403)
    assert.equal(rejected.body.includes('token'), false, 'the health answer must not disclose token state')

    const accepted = await rawGet(port, '/__dsh_remote/health', '127.0.0.1:' + String(port))
    // Reaching the route without a session is still a 401; what matters is that
    // the refusal is the session check, not a leak of the proxy's internals.
    assert.equal(accepted.status, 401)
    assert.equal(accepted.body.includes('token'), false)
  })
})

test('login failures are throttled before the sixth attempt', async () => {
  await withProxy({}, async (_proxy, port) => {
    const submit = () => fetch('http://127.0.0.1:' + String(port) + '/__dsh_remote/login', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'username=admin&password=wrong&next=%2F',
      redirect: 'manual',
    })
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await submit()
      assert.equal(response.status, 303)
    }
    const blocked = await submit()
    assert.equal(blocked.status, 429)
  })
})

test('a cross-origin login POST is refused', async () => {
  await withProxy({}, async (_proxy, port) => {
    const response = await fetch('http://127.0.0.1:' + String(port) + '/__dsh_remote/login', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'http://evil.example' },
      body: 'username=admin&password=test-password',
      redirect: 'manual',
    })
    assert.equal(response.status, 403)
  })
})
