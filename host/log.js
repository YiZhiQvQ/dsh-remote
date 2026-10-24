/**
 * Scoped debug logging. Silent unless DEBUG matches, so a normal boot stays
 * quiet while a field report can be reproduced with one environment variable.
 *
 * @module dsh-remote/host/log
 */

const PREFIX = 'dsh-remote'

function debugEnabled() {
  const value = process.env.DEBUG
  if (typeof value !== 'string' || value.length === 0) return false
  return value.split(/[,\s]+/).some((entry) => entry === '*' || entry === PREFIX || entry.startsWith(PREFIX + ':') || entry.startsWith(PREFIX + '*'))
}

const enabled = debugEnabled()

/**
 * @param {string} scope - dotted scope, e.g. `proxy.upstream`.
 * @param {string} message
 * @param {...unknown} rest
 */
function debug(scope, message, ...rest) {
  if (!enabled) return
  console.log('[' + PREFIX + ':' + scope + '] ' + message, ...rest)
}

/**
 * Always-visible warnings. Used for conditions the operator must act on but
 * which do not stop the plugin (port conflict, stale anchors, fallbacks).
 * @param {string} message
 */
function warn(message) {
  console.warn('[' + PREFIX + '] ' + message)
}

/** @param {string} message */
function info(message) {
  console.log('[' + PREFIX + '] ' + message)
}

export { debug, warn, info, debugEnabled }
