import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createBrowseHandler } from '../host/routes/browse.js'

async function withRoot(fn) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-remote-browse-'))
  try {
    return await fn(root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

test('browse lists only child directories, flags hidden ones, and returns crumbs', async () => {
  await withRoot(async (root) => {
    await mkdir(join(root, 'alpha'))
    await mkdir(join(root, '.hidden'))
    await writeFile(join(root, 'note.txt'), 'x')
    const browse = createBrowseHandler()
    const response = await browse(new Request('http://x/api/remote/browse?path=' + encodeURIComponent(root)))
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.ok, true)
    assert.equal(body.path, resolve(root))
    assert.deepEqual(body.entries.map((entry) => entry.name), ['.hidden', 'alpha'])
    assert.equal(body.entries[0].hidden, true)
    assert.equal(body.entries[1].hidden, false)
    assert.equal(body.crumbs.at(-1).path, resolve(root))
    assert.equal(body.truncated, false)
    if (process.platform === 'win32') {
      assert.ok(Array.isArray(body.roots), 'roots is an array')
      assert.ok(body.roots.some((root) => /^[A-Z]:$/.test(root.name)), 'the system drive is listed')
    } else {
      assert.deepEqual(body.roots, [])
    }
  })
})

test('browse creates one child directory and rejects a duplicate', async () => {
  await withRoot(async (root) => {
    const browse = createBrowseHandler()
    const create = (name) => browse(new Request('http://x/api/remote/browse', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: root, name }),
    }))
    const created = await create('beta')
    assert.equal(created.status, 200)
    const body = await created.json()
    assert.equal(body.ok, true)
    assert.equal((await stat(body.path)).isDirectory(), true)
    const duplicate = await create('beta')
    assert.equal(duplicate.status, 409)
    assert.equal((await duplicate.json()).ok, false)
  })
})

test('browse rejects relative paths and path-segment escapes', async () => {
  await withRoot(async (root) => {
    const browse = createBrowseHandler()
    const relative = await browse(new Request('http://x/api/remote/browse?path=relative'))
    assert.equal(relative.status, 400)
    const escape = await browse(new Request('http://x/api/remote/browse', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: root, name: '..' }),
    }))
    assert.equal(escape.status, 400)
    const separator = await browse(new Request('http://x/api/remote/browse', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: root, name: 'a/b' }),
    }))
    assert.equal(separator.status, 400)
  })
})
