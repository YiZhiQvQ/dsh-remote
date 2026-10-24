import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { startLanProxy } from '../host/proxy/server.js'
import { closeListener } from '../host/proxy/shutdown.js'

/**
 * What a plugin toggle actually does to this listener.
 *
 * Cordis awaits whatever an `ctx.effect` disposer returns. The plugin used to
 * start the close in the background and dispose the agent in the same breath, so
 * a disable→enable cycle could re-listen on a port the old server still held and
 * in-flight downloads were cut off mid-response. These tests pin the two modes
 * that replaced it.
 */

function makeProxy(port) {
  return startLanProxy({
    listenPort: port,
    targetPort: 52551,
    dshToken: 't',
    secretFile: '',
    username: 'admin',
    password: 'pw',
  })
}

function freePort() {
  return 41400 + Math.floor(Math.random() * 500)
}

test('close settles only once the port is actually released', async () => {
  const port = freePort()
  const proxy = makeProxy(port)
  try {
    assert.equal(await proxy.start(), true)
    assert.equal(proxy.state.phase, 'running')

    await proxy.close()

    // The assertion that matters for a toggle: a fresh listener can bind the
    // same port immediately, with no retry and no EADDRINUSE.
    assert.equal(proxy.state.phase, 'stopped')
    const next = makeProxy(port)
    try {
      assert.equal(await next.start(), true, 'the port must be free the moment close resolves')
    } finally {
      await next.close()
      next.dispose()
    }
  } finally {
    await proxy.close()
    proxy.dispose()
  }
})

test('a drained close lets an in-flight response finish', async () => {
  // Exercised on closeListener directly: the point under test is the shutdown
  // policy, and going through the proxy would first have to satisfy its gate.
  const server = createServer((_request, response) => {
    setTimeout(() => {
      response.writeHead(200, { 'content-type': 'text/plain' })
      response.end('finished')
    }, 120)
  })
  await new Promise((resolve) => server.listen(0, '0.0.0.0', resolve))
  const port = server.address().port

  const pending = fetch('http://127.0.0.1:' + String(port) + '/')
    .then((response) => response.text())
    .catch((error) => 'aborted: ' + String(error && error.message))
  await new Promise((resolve) => setTimeout(resolve, 40))

  // Short grace: the response lands in 120 ms, so a 2 s cap proves the drain
  // waited for real work without making the suite wait for the 5 s default.
  await closeListener(server, { drain: true, graceMs: 2000 })
  assert.equal(await pending, 'finished', 'a drain must not cut an in-flight response')
})

test('a pause cuts the in-flight response immediately', async () => {
  // The other half of the policy: Pause means "stop serving now", so the same
  // slow response is dropped rather than awaited.
  const server = createServer((_request, response) => {
    setTimeout(() => {
      response.writeHead(200, { 'content-type': 'text/plain' })
      response.end('finished')
    }, 400)
  })
  await new Promise((resolve) => server.listen(0, '0.0.0.0', resolve))
  const port = server.address().port

  const pending = fetch('http://127.0.0.1:' + String(port) + '/')
    .then((response) => response.text())
    .catch((error) => 'aborted: ' + String(error && error.message))
  await new Promise((resolve) => setTimeout(resolve, 40))

  await closeListener(server)
  const body = await pending
  assert.notEqual(body, 'finished', 'a pause must not wait for the transfer')
})

test('closeListener resolves even for a server that never finishes', async () => {
  const server = createServer(() => {})
  await new Promise((resolve) => server.listen(0, '0.0.0.0', resolve))
  const started = Date.now()
  await closeListener(server, { graceMs: 50 })
  assert.ok(Date.now() - started < 2000, 'the backstop timer bounds the wait')
})

test('a second close is harmless', async () => {
  const proxy = makeProxy(freePort())
  try {
    assert.equal(await proxy.start(), true)
    await proxy.close()
    await proxy.close()
    assert.equal(proxy.state.phase, 'stopped')
  } finally {
    proxy.dispose()
  }
})
