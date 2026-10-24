import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createDownloadHandler, parseRange } from '../host/routes/download.js'
import { createUploadHandler } from '../host/routes/upload.js'

function fakeFs() {
  return {
    async resolve(requested) { return { displayPath: requested } },
    async stat(target) {
      const info = await stat(target.displayPath ?? target)
      return { type: info.isFile() ? 'file' : 'directory', size: info.size, mtimeMs: info.mtimeMs }
    },
  }
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'dsh-remote-transfer-'))
  return { root, fs: fakeFs(), cleanup: () => rm(root, { recursive: true, force: true }) }
}

test('parseRange understands the forms a browser and a video element send', () => {
  assert.deepEqual(parseRange('bytes=0-9', 100), { start: 0, end: 9 })
  assert.deepEqual(parseRange('bytes=10-', 100), { start: 10, end: 99 })
  assert.deepEqual(parseRange('bytes=-10', 100), { start: 90, end: 99 })
  assert.deepEqual(parseRange('bytes=0-1000', 100), { start: 0, end: 99 })
  assert.equal(parseRange('bytes=100-', 100), 'invalid')
  assert.equal(parseRange('bytes=5-1', 100), 'invalid')
  assert.equal(parseRange('items=0-9', 100), undefined)
  assert.equal(parseRange(undefined, 100), undefined)
})

test('a range request answers 206 with exactly the requested bytes', async () => {
  const { root, fs, cleanup } = await fixture()
  try {
    const file = join(root, 'clip.bin')
    await writeFile(file, Buffer.from('0123456789abcdefghij'))
    const download = createDownloadHandler({ fs })
    const response = await download(new Request('http://x/api/remote/download?path=' + encodeURIComponent(file), {
      headers: { range: 'bytes=10-14' },
    }))
    assert.equal(response.status, 206)
    assert.equal(response.headers.get('content-range'), 'bytes 10-14/20')
    assert.equal(response.headers.get('accept-ranges'), 'bytes')
    assert.equal(await response.text(), 'abcde')
  } finally {
    await cleanup()
  }
})

test('a range past the end answers 416 with the real size', async () => {
  const { root, fs, cleanup } = await fixture()
  try {
    const file = join(root, 'small.txt')
    await writeFile(file, 'abc')
    const download = createDownloadHandler({ fs })
    const response = await download(new Request('http://x/api/remote/download?path=' + encodeURIComponent(file), {
      headers: { range: 'bytes=5-9' },
    }))
    assert.equal(response.status, 416)
    assert.equal(response.headers.get('content-range'), 'bytes */3')
  } finally {
    await cleanup()
  }
})

test('an ETag match answers 304 and HEAD carries no body', async () => {
  const { root, fs, cleanup } = await fixture()
  try {
    const file = join(root, 'doc.txt')
    await writeFile(file, 'hello')
    const download = createDownloadHandler({ fs })
    const first = await download(new Request('http://x/api/remote/download?path=' + encodeURIComponent(file)))
    const etag = first.headers.get('etag')
    assert.ok(etag)
    await first.text()

    const cached = await download(new Request('http://x/api/remote/download?path=' + encodeURIComponent(file), {
      headers: { 'if-none-match': etag },
    }))
    assert.equal(cached.status, 304)

    const head = await download(new Request('http://x/api/remote/download?path=' + encodeURIComponent(file), { method: 'HEAD' }))
    assert.equal(head.status, 200)
    assert.equal(head.headers.get('content-length'), '5')
    assert.equal(await head.text(), '')
  } finally {
    await cleanup()
  }
})

test('a deleted file answers 404 instead of failing the stream later', async () => {
  const { root, fs, cleanup } = await fixture()
  try {
    const file = join(root, 'gone.txt')
    const download = createDownloadHandler({ fs })
    const response = await download(new Request('http://x/api/remote/download?path=' + encodeURIComponent(file)))
    assert.equal(response.status, 404)
  } finally {
    await cleanup()
  }
})

test('upload lands the bytes and leaves no temporary residue', async () => {
  const { root, cleanup } = await fixture()
  try {
    const target = join(root, 'uploads')
    await mkdir(target, { recursive: true })
    const upload = createUploadHandler({ maxBytes: 1024 * 1024 })
    const response = await upload(new Request('http://x/api/remote/upload?path=' + encodeURIComponent(target) + '&name=probe.txt', {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: new TextEncoder().encode('remote upload'),
    }))
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.size, 13)
    assert.equal(await readFile(join(target, 'probe.txt'), 'utf8'), 'remote upload')

    const hidden = join(target, '.dsh-remote-tmp')
    const leftovers = await readdir(hidden).catch(() => [])
    assert.deepEqual(leftovers, [], 'the temporary directory must be empty after a successful upload')
  } finally {
    await cleanup()
  }
})

test('an upload over the limit answers 413 and leaves nothing behind', async () => {
  const { root, cleanup } = await fixture()
  try {
    const target = join(root, 'uploads')
    await mkdir(target, { recursive: true })
    const upload = createUploadHandler({ maxBytes: 4 })
    const response = await upload(new Request('http://x/api/remote/upload?path=' + encodeURIComponent(target) + '&name=big.bin', {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: new Uint8Array(64).fill(65),
    }))
    assert.equal(response.status, 413)
    const listing = (await readdir(target)).filter((name) => name !== '.dsh-remote-tmp')
    assert.deepEqual(listing, [], 'no partial file and no placeholder may survive')
    const hidden = await readdir(join(target, '.dsh-remote-tmp')).catch(() => [])
    assert.deepEqual(hidden, [], 'the temporary file is removed')
  } finally {
    await cleanup()
  }
})

test('a duplicate name is suffixed instead of overwritten', async () => {
  const { root, cleanup } = await fixture()
  try {
    const target = join(root, 'uploads')
    await mkdir(target, { recursive: true })
    const upload = createUploadHandler({ maxBytes: 1024 * 1024 })
    const send = (text) => upload(new Request('http://x/api/remote/upload?path=' + encodeURIComponent(target) + '&name=note.txt', {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: new TextEncoder().encode(text),
    }))
    await send('first')
    const second = await send('second')
    const body = await second.json()
    assert.equal(body.name, 'note (1).txt')
    assert.equal(await readFile(join(target, 'note.txt'), 'utf8'), 'first')
    assert.equal(await readFile(join(target, 'note (1).txt'), 'utf8'), 'second')
  } finally {
    await cleanup()
  }
})

test('unsafe names, wrong content types and missing directories are refused', async () => {
  const { root, cleanup } = await fixture()
  try {
    const target = join(root, 'uploads')
    await mkdir(target, { recursive: true })
    const upload = createUploadHandler({})
    const post = (name, contentType = 'application/octet-stream') => upload(new Request(
      'http://x/api/remote/upload?path=' + encodeURIComponent(target) + '&name=' + encodeURIComponent(name),
      { method: 'POST', headers: { 'content-type': contentType }, body: new Uint8Array([1, 2, 3]) },
    ))
    assert.equal((await post('..')).status, 400)
    assert.equal((await post('a/b.txt')).status, 400)
    assert.equal((await post('ok.txt', 'text/plain')).status, 415)
    assert.equal((await post('ok.txt')).status, 200)

    const missing = await upload(new Request(
      'http://x/api/remote/upload?path=' + encodeURIComponent(join(root, 'nope')) + '&name=ok.txt',
      { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: new Uint8Array([1]) },
    ))
    assert.equal(missing.status, 404)
  } finally {
    await cleanup()
  }
})
