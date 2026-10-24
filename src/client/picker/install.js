/**
 * Swap the host directory picker for the in-app dialog on a LAN page.
 *
 * The native flow is renderless: it calls ctx.uiWorkspace.pickDirectory() when
 * the operator opens "add workspace". Replacing that one method intercepts the
 * flow without touching the slot registry, so the local desktop window keeps
 * the native OS chooser and no second occupant can race the dialog.
 *
 * @module dsh-remote/client/picker/install
 */
import { showDirectoryDialog } from './dialog.js'

/**
 * @param {any} ctx
 * @param {{isRemoteOrigin: () => boolean, t: (key: string) => string}} options
 * @returns {() => void} disposer
 */
function installRemoteDirectoryPicker(ctx, options) {
  if (!options.isRemoteOrigin()) return () => {}
  const workspace = ctx.uiWorkspace
  if (!workspace || typeof workspace.pickDirectory !== 'function') return () => {}

  const original = workspace.pickDirectory
  const patched = function pickDirectory() {
    return showDirectoryDialog({ t: options.t })
  }

  /** @param {any} target */
  function patchOn(target) {
    try {
      target.pickDirectory = patched
    } catch {
      // A getter-only or frozen property falls through to defineProperty.
    }
    if (target.pickDirectory === patched) return true
    try {
      Object.defineProperty(target, 'pickDirectory', {
        value: patched,
        configurable: true,
        writable: true,
      })
    } catch {
      return false
    }
    return target.pickDirectory === patched
  }

  let target = workspace
  if (!patchOn(target)) {
    const proto = Object.getPrototypeOf(workspace)
    // Only a class prototype that actually owns the method. Never fall back to
    // Object.prototype: patching it would leak into every object on the page.
    if (!proto || proto === Object.prototype || typeof proto.pickDirectory !== 'function') return () => {}
    if (!patchOn(proto)) return () => {}
    target = proto
  }

  return () => {
    if (target.pickDirectory !== patched) return
    try {
      target.pickDirectory = original
    } catch {
      // The service was frozen after the patch; leaving it is safer than
      // restoring a half-written state.
    }
  }
}

export { installRemoteDirectoryPicker }
