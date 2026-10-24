import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply } from '../index.js'

const root = await mkdtemp(join(tmpdir(), 'dsh-remote-routes-'))
const uploadDir = join(root, 'uploads')
await mkdir(uploadDir, { recursive: true })
const artifact = join(root, 'artifact.txt')
await writeFile(artifact, 'artifact bytes', 'utf8')

// A random high port keeps this test independent of the real 3080 listener.
const listenPort = 39000 + Math.floor(Math.random() * 1000)
const routes = new Map()
const disposers = []
const ctx = {
  webServer: { port: 52551 },
  webApp: { getAdvertisedUrl: () => 'http://10.40.16.57:' + String(listenPort) + '/' },
  connection: {
    authenticatedUrl: (url) => url + (url.includes('?') ? '&' : '?') + 'token=test-token',
    fetch: {
      register(route) {
        routes.set(route.path, route)
        return () => routes.delete(route.path)
      },
    },
  },
  fs: {
    async resolve(requested) { return { displayPath: requested } },
    async stat(target) {
      const info = await stat(target.displayPath ?? target)
      return { type: info.isFile() ? 'file' : 'directory', size: info.size }
    },
  },
  effect(fn) {
    const dispose = fn()
    if (typeof dispose === 'function') disposers.push(dispose)
  },
  logger: { info() {} },
}

apply(ctx, {
  listenPort,
  dshPort: 52551,
  maxDownloadBytes: 1024 * 1024,
  maxUploadBytes: 1024 * 1024,
  authFile: join(root, 'auth.json'),
  secretFile: join(root, 'secret'),
})

test.after(async () => {
  for (const dispose of disposers.reverse()) {
    try {
      await dispose()
    } catch {
      // already disposed
    }
  }
  await rm(root, { recursive: true, force: true })
})

test('registers only the single-admin remote routes', () => {
  assert.deepEqual([...routes.keys()].sort(), [
    '/api/remote/browse',
    '/api/remote/control',
    '/api/remote/download',
    '/api/remote/info',
    '/api/remote/pairing',
    '/api/remote/qr',
    '/api/remote/upload',
  ])
  assert.equal(routes.has('/api/mobile/accounts'), false)
  assert.equal(routes.has('/api/mobile/account'), false)
})

test('control pauses and resumes the proxy', async () => {
  const control = routes.get('/api/remote/control')
  const pause = await control.fetch(new Request('http://127.0.0.1/api/remote/control?action=pause', { method: 'POST' }))
  assert.equal(pause.status, 200)
  assert.equal((await pause.json()).paused, true)
  const resume = await control.fetch(new Request('http://127.0.0.1/api/remote/control?action=resume', { method: 'POST' }))
  assert.equal(resume.status, 200)
  assert.equal((await resume.json()).paused, false)
})

test('info reports the desktop DSH and the single admin login', async () => {
  const response = await routes.get('/api/remote/info').fetch(new Request('http://127.0.0.1/api/remote/info'))
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.ok, true)
  assert.equal(body.role, 'admin')
  assert.equal(body.dshPort, 52551)
  assert.equal(body.listenPort, listenPort)
  assert.equal(body.auth.role, 'admin')
  assert.equal(body.auth.username, 'admin')
  assert.equal(body.multiAccount, undefined)
  assert.equal(JSON.stringify(body).includes('token'), false)
})

test('pairing returns one URL per detected LAN address', async () => {
  const response = await routes.get('/api/remote/pairing').fetch(new Request('http://127.0.0.1/api/remote/pairing'))
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.ok(Array.isArray(body.urls))
  for (const entry of body.urls) {
    assert.match(entry.url, new RegExp('^http://\\d+\\.\\d+\\.\\d+\\.\\d+:' + String(listenPort) + '/$'))
  }
})

test('qr rejects an unknown address', async () => {
  const response = await routes.get('/api/remote/qr').fetch(new Request('http://127.0.0.1/api/remote/qr?address=203.0.113.9'))
  assert.equal(response.status, 400)
})

test('download streams a real file', async () => {
  const response = await routes.get('/api/remote/download').fetch(new Request('http://127.0.0.1/api/remote/download?path=' + encodeURIComponent(artifact)))
  assert.equal(response.status, 200)
  assert.equal(await response.text(), 'artifact bytes')
})

test('upload writes a streamed file into an existing directory', async () => {
  const response = await routes.get('/api/remote/upload').fetch(new Request(
    'http://127.0.0.1/api/remote/upload?path=' + encodeURIComponent(uploadDir) + '&name=probe.txt',
    { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: new TextEncoder().encode('remote upload') },
  ))
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.ok, true)
  assert.equal(await readFile(join(uploadDir, 'probe.txt'), 'utf8'), 'remote upload')
})
