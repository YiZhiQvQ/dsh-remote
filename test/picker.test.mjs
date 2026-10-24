import test from 'node:test'
import assert from 'node:assert/strict'
import { installRemoteDirectoryPicker } from '../src/client/picker/install.js'

function fakeCtx() {
  return { uiWorkspace: { pickDirectory: () => Promise.resolve('native') } }
}

test('leaves the picker alone on the local desktop', () => {
  const ctx = fakeCtx()
  const original = ctx.uiWorkspace.pickDirectory
  const dispose = installRemoteDirectoryPicker(ctx, { isRemoteOrigin: () => false, t: (key) => key })
  assert.equal(ctx.uiWorkspace.pickDirectory, original)
  dispose()
  assert.equal(ctx.uiWorkspace.pickDirectory, original)
})

test('replaces and restores pickDirectory on a remote page', () => {
  const ctx = fakeCtx()
  const original = ctx.uiWorkspace.pickDirectory
  const dispose = installRemoteDirectoryPicker(ctx, { isRemoteOrigin: () => true, t: (key) => key })
  assert.notEqual(ctx.uiWorkspace.pickDirectory, original)
  dispose()
  assert.equal(ctx.uiWorkspace.pickDirectory, original)
})

test('does not pollute Object.prototype for a frozen plain service', () => {
  const ctx = { uiWorkspace: Object.freeze({ pickDirectory: () => Promise.resolve('native') }) }
  const dispose = installRemoteDirectoryPicker(ctx, { isRemoteOrigin: () => true, t: (key) => key })
  assert.equal(Object.prototype.pickDirectory, undefined)
  dispose()
  assert.equal(Object.prototype.pickDirectory, undefined)
})
