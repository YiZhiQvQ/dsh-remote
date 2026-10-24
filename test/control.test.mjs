import test from 'node:test'
import assert from 'node:assert/strict'
import { createRoutes } from '../host/routes/index.js'
import { startLanProxy } from '../host/proxy/server.js'

/**
 * The pause/resume control is pressed from a page served by the very listener it
 * tears down. Two things made that slow: the handler awaited the teardown before
 * answering (so the socket died mid-response), and the panel refreshed while the
 * listener was still closing.
 */

async function harness(options = {}) {
  const port = options.port ?? (39900 + Math.floor(Math.random() * 400))
  const proxy = startLanProxy({
    listenPort: port,
    targetPort: 52551,
    dshToken: 't',
    secretFile: '',
    username: 'admin',
    password: 'pw',
  })
  await proxy.start()
  let paused = false
  const ran = []
  const routes = createRoutes({
    fs: undefined,
    maxDownloadBytes: 1024,
    maxUploadBytes: 1024,
    rangeEnabled: true,
    uploadTempSubdir: '.tmp',
    uploadTempTtlMs: 1000,
    listenPort: port,
    dshPort: () => 52551,
    listenPortNow: () => proxy.state.listenPort,
    proxyState: () => ({
      paused,
      proxy: { running: proxy.state.phase === 'running', phase: proxy.state.phase, error: proxy.state.error, health: {} },
    }),
    pauseProxy: async () => {
      ran.push('pause')
      paused = true
      await proxy.close()
      return true
    },
    resumeProxy: async () => {
      ran.push('resume')
      paused = false
      await proxy.start()
      return true
    },
    warnOnce: () => {},
    probeTimeoutMs: 100,
    configuredWarnings: [],
  })
  return { proxy, routes, ran, port }
}

test('the control route answers before the listener goes away', async () => {
  const { proxy, routes } = await harness()
  try {
    const control = routes.get('/api/remote/control')
    const started = process.hrtime.bigint()
    const response = await control.fetch(new Request('http://x/api/remote/control?action=pause', { method: 'POST' }))
    const elapsed = Number(process.hrtime.bigint() - started) / 1e6
    assert.equal(response.status, 200)
    assert.ok(elapsed < 50, 'the answer must not wait for the teardown, took ' + elapsed.toFixed(1) + ' ms')

    const body = await response.json()
    assert.equal(body.scheduled, 'pause')
    assert.equal(body.paused, true, 'the operator is told the new state immediately')
    assert.equal(body.proxy.running, false)
  } finally {
    await proxy.close()
    proxy.dispose()
  }
})

test('an unknown action is refused and changes nothing', async () => {
  const { proxy, routes, ran } = await harness()
  try {
    const control = routes.get('/api/remote/control')
    const response = await control.fetch(new Request('http://x/api/remote/control?action=explode', { method: 'POST' }))
    assert.equal(response.status, 400)
    await new Promise((resolve) => setTimeout(resolve, 50))
    assert.deepEqual(ran, [])
    assert.equal(proxy.state.phase, 'running')
  } finally {
    await proxy.close()
    proxy.dispose()
  }
})

test('the scheduled work actually runs, and repeated presses stay ordered', async () => {
  const { proxy, routes, ran } = await harness()
  try {
    const control = routes.get('/api/remote/control')
    for (const action of ['pause', 'resume', 'pause', 'resume']) {
      const response = await control.fetch(new Request('http://x/api/remote/control?action=' + action, { method: 'POST' }))
      assert.equal(response.status, 200)
    }
    await new Promise((resolve) => setTimeout(resolve, 700))
    assert.deepEqual(ran, ['pause', 'resume', 'pause', 'resume'])
    assert.equal(proxy.state.phase, 'running', 'the last action wins')
  } finally {
    await proxy.close()
    proxy.dispose()
  }
})

test('info reports the live listener on its first read', async () => {
  // The harness starts the proxy, so the truthful answer is "reachable". This
  // used to assert false because the route answered from an empty probe cache
  // and only refreshed in the background — which is the bug that made the panel
  // show a dead port until the operator pressed refresh.
  const { proxy, routes } = await harness()
  try {
    const info = routes.get('/api/remote/info')
    const first = await (await info.fetch(new Request('http://x/api/remote/info'))).json()
    assert.equal(first.portProxyReachable, true, 'a running listener is reported reachable immediately')
    assert.equal(first.paused, false)
  } finally {
    await proxy.close()
    proxy.dispose()
  }
})

test('info stops probing once the listener is down', async () => {
  const { proxy, routes } = await harness()
  try {
    await proxy.close()
    const info = routes.get('/api/remote/info')
    const started = Date.now()
    const body = await (await info.fetch(new Request('http://x/api/remote/info'))).json()
    assert.equal(body.portProxyReachable, false, 'a stopped listener is reported without a probe')
    assert.ok(Date.now() - started < 250, 'and without waiting for a timeout')
  } finally {
    proxy.dispose()
  }
})
