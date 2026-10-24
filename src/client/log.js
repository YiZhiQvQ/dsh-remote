/**
 * Client-side diagnostics. Silent unless `localStorage.dshRemoteDebug` is set,
 * so a normal phone session keeps the console clean.
 *
 * @module dsh-remote/client/log
 */

/** @type {boolean} */
let enabled = false
try {
  if (typeof globalThis.localStorage !== 'undefined') {
    enabled = globalThis.localStorage.getItem('dshRemoteDebug') === '1'
  }
} catch {
  // Private-mode storage can throw on read.
  enabled = false
}

/**
 * @param {string} scope
 * @param {string} message
 */
function debug(scope, message) {
  if (!enabled) return
  console.log('[dsh-remote:' + scope + '] ' + message)
}

export { debug }
