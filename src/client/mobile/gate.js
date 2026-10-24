/**
 * Capability gate for the mobile layer.
 *
 * The mobile shell styles DSH's own DOM. That DOM is not a published interface:
 * the `data-*` attributes and especially the hashed CSS-module class fragments
 * move between DSH releases. Rather than guess from package versions (the version
 * on disk is not necessarily the version on screen), probe the live document
 * once, and refuse to install the layer when something required is absent. The
 * result is that an incompatible DSH shows the desktop layout with one console
 * warning, instead of a half-styled, unusable page.
 *
 * @module dsh-remote/client/mobile/gate
 */
import { ANCHORS } from './anchors.js'


/** Cap on waiting for the React shell to mount before giving up. */
const MOUNT_TIMEOUT_MS = 2000

/**
 * @typedef {object} Capabilities
 * @property {boolean} ok - every required anchor was found.
 * @property {string[]} missing - required anchor ids that were not found.
 * @property {string[]} missingOptional - optional anchor ids that were not found.
 * @property {boolean} ready - the shell mounted within the timeout.
 */

/**
 * Run one probe against the live document.
 * @param {Document} document
 * @returns {Capabilities}
 */
function probe(document) {
  const missing = []
  const missingOptional = []
  for (const anchor of ANCHORS) {
    let found = false
    try {
      found = document.querySelector(anchor.selector) !== null
    } catch {
      found = false
    }
    if (found) continue
    if (anchor.required) missing.push(anchor.id)
    else missingOptional.push(anchor.id)
  }
  return { ok: missing.length === 0, missing, missingOptional, ready: true }
}

/**
 * Publish the probe result on the root element for field diagnosis.
 * @param {HTMLElement} root
 * @param {Capabilities} caps
 */
function publish(root, caps) {
  try {
    if (caps.ok) {
      root.removeAttribute('data-dshm-caps')
      return
    }
    root.setAttribute('data-dshm-caps', 'missing:' + caps.missing.join(','))
  } catch {
    // A non-DOM document in tests.
  }
}

/**
 * Wait for the React shell, then probe once.
 *
 * A childList observer plus a rAF coalescer replaces the old 250 ms × 40 polling
 * loop: the shell mounts within a frame or two of the first paint in practice,
 * and the observer costs nothing while idle.
 *
 * @param {Document} document
 * @param {Window} window
 * @param {number} [timeoutMs]
 * @returns {Promise<Capabilities>}
 */
function waitForShell(document, window, timeoutMs = MOUNT_TIMEOUT_MS) {
  const immediate = probe(document)
  if (immediate.ok) return Promise.resolve(immediate)

  return new Promise((resolve) => {
    let settled = false
    let frame = 0
    const finish = (caps) => {
      if (settled) return
      settled = true
      if (observer !== undefined) observer.disconnect()
      if (frame !== 0) window.cancelAnimationFrame(frame)
      window.clearTimeout(timer)
      resolve(caps)
    }
    const check = () => {
      frame = 0
      const caps = probe(document)
      if (caps.ok) finish(caps)
    }
    const schedule = () => {
      if (frame !== 0) return
      frame = window.requestAnimationFrame(check)
    }
    const observer = typeof MutationObserver === 'function'
      ? new MutationObserver(schedule)
      : undefined
    if (observer !== undefined) {
      try {
        observer.observe(document.documentElement, { childList: true, subtree: true })
      } catch {
        // Nothing to observe in a stub document.
      }
    }
    const timer = window.setTimeout(() => finish(probe(document)), timeoutMs)
    schedule()
  })
}

export { probe, publish, waitForShell, MOUNT_TIMEOUT_MS }
