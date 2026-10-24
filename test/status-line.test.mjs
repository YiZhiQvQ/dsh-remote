import test from 'node:test'
import assert from 'node:assert/strict'
import { createRoutes } from '../host/routes/index.js'
import { startLanProxy } from '../host/proxy/server.js'

/**
 * The listener-status row on the panel.
 *
 * The panel opens on `/api/remote/info`, so the route must not block on a TCP
 * timeout — but it also must not answer "no listener" from an empty cache. It
 * did the latter, which is why the row looked broken until the operator pressed
 * refresh once.
 */

async function harness() {
  const port = 42100 + Math.floor(Math.random() * 400)
  const proxy = startLanProxy({
    listenPort: port,
    targetPort: 52551,
    dshToken: 't',
    secretFile: '',
    username: 'admin',
    password: 'pw',
  })
  await proxy.start()
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
      paused: false,
      proxy: { running: proxy.state.phase === 'running', phase: proxy.state.phase, error: proxy.state.error, health: {} },
    }),
    pauseProxy: async () => true,
    resumeProxy: async () => true,
    warnOnce: () => {},
    probeTimeoutMs: 300,
    configuredWarnings: [],
  })
  return { proxy, routes, port }
}

test('the first read reports a live listener without a second refresh', async () => {
  const { proxy, routes } = await harness()
  try {
    const info = routes.get('/api/remote/info')
    const body = await (await info.fetch(new Request('http://x/api/remote/info'))).json()
    // The whole point: the very first answer is true, not a cached false.
    assert.equal(body.portProxyReachable, true, 'the panel must not need a refresh to show a live port')
  } finally {
    await proxy.close()
    proxy.dispose()
  }
})

test('a stopped listener still reports false without waiting for a probe', async () => {
  const { proxy, routes } = await harness()
  try {
    await proxy.close()
    const info = routes.get('/api/remote/info')
    const started = Date.now()
    const body = await (await info.fetch(new Request('http://x/api/remote/info'))).json()
    assert.equal(body.portProxyReachable, false)
    assert.ok(Date.now() - started < 250, 'a stopped listener answers from the state, not a timeout')
  } finally {
    proxy.dispose()
  }
})

test('concurrent first reads share one probe', async () => {
  const { proxy, routes } = await harness()
  try {
    const info = routes.get('/api/remote/info')
    const bodies = await Promise.all(
      Array.from({ length: 5 }, () => info.fetch(new Request('http://x/api/remote/info')).then((r) => r.json())),
    )
    for (const body of bodies) assert.equal(body.portProxyReachable, true)
  } finally {
    await proxy.close()
    proxy.dispose()
  }
})

test('a cached answer is reused instead of re-probing on every read', async () => {
  const { proxy, routes } = await harness()
  try {
    const info = routes.get('/api/remote/info')
    const first = await (await info.fetch(new Request('http://x/api/remote/info'))).json()
    assert.equal(first.portProxyReachable, true)
    // A second read inside the cache window answers immediately.
    const started = Date.now()
    const second = await (await info.fetch(new Request('http://x/api/remote/info'))).json()
    assert.equal(second.portProxyReachable, true)
    assert.ok(Date.now() - started < 200, 'the cached answer is not re-probed')
  } finally {
    await proxy.close()
    proxy.dispose()
  }
})
