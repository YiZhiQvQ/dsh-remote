/**
 * A `URL` shim for kernels that mis-parse non-special schemes.
 *
 * DSH derives a resource's protocol with `new URL(address).hostname`. On the
 * affected ArkWeb kernel that hostname comes back empty for `dsh-resource://`,
 * so no provider is found, the resource settles on `status: "none"`, and the
 * preview reports "unavailable" without issuing a request.
 *
 * Only a non-special scheme with an empty hostname is repaired; special schemes
 * are left to the native parser.
 *
 * @module dsh-remote/client/url-compat
 */

const SPECIAL = new Set(['http:', 'https:', 'ws:', 'wss:', 'ftp:', 'file:', 'data:', 'blob:', 'about:', 'javascript:'])

/**
 * @param {string} input
 * @returns {Record<string, string>|undefined}
 */
function parseNonSpecial(input) {
  const m = /^([A-Za-z][A-Za-z0-9+.-]*:)\/\/([^/?#]*)([^?#]*)(\?[^#]*)?(#.*)?$/.exec(input)
  if (m === null) return undefined
  const at = m[2].lastIndexOf('@')
  const host = at === -1 ? m[2] : m[2].slice(at + 1)
  const colon = host.startsWith('[') ? -1 : host.lastIndexOf(':')
  return {
    protocol: m[1].toLowerCase(),
    hostname: (colon === -1 ? host : host.slice(0, colon)).toLowerCase(),
    port: colon === -1 ? '' : host.slice(colon + 1),
    pathname: m[3] || '/',
    search: m[4] || '',
    hash: m[5] || '',
  }
}

/**
 * @param {any} parsed
 * @param {string} input
 * @returns {boolean}
 */
function needsRepair(parsed, input) {
  try {
    if (SPECIAL.has(String(parsed.protocol).toLowerCase())) return false
    if (parsed.hostname !== '') return false
    return parseNonSpecial(input) !== undefined
  } catch {
    return false
  }
}

/**
 * @param {any} [scope]
 * @returns {{applied: boolean}}
 */
function installUrlCompat(scope) {
  const target = scope ?? (typeof globalThis === 'undefined' ? undefined : globalThis)
  const Native = target && target.URL
  if (typeof Native !== 'function') return { applied: false }

  const sample = 'dsh-resource://file/probe'
  let broken
  try {
    broken = needsRepair(new Native(sample), sample)
  } catch {
    broken = true
  }
  if (!broken) return { applied: false }

  /** @param {string} input @param {any} [base] */
  function Patched(input, base) {
    const native = base === undefined ? new Native(input) : new Native(input, base)
    const fixed = needsRepair(native, String(input)) ? parseNonSpecial(String(input)) : undefined
    if (fixed === undefined) return native
    // A plain object, deliberately NOT on `Native.prototype`: that prototype's
    // accessors need the URL internal slots, so an object created from it throws
    // "Illegal invocation" the moment anything reads a field. Only the fields
    // below are ever used for a resource address.
    const out = {}
    Object.assign(out, {
      protocol: fixed.protocol,
      hostname: fixed.hostname,
      host: fixed.hostname + (fixed.port === '' ? '' : ':' + fixed.port),
      port: fixed.port,
      pathname: fixed.pathname,
      search: fixed.search,
      hash: fixed.hash,
      href: String(input),
    })
    return out
  }

  try {
    Object.setPrototypeOf(Patched, Native)
    Patched.prototype = Native.prototype
    for (const key of Object.getOwnPropertyNames(Native)) {
      if (key === 'prototype' || key === 'length' || key === 'name') continue
      try {
        Object.defineProperty(Patched, key, Object.getOwnPropertyDescriptor(Native, key))
      } catch {
        // Skip a non-configurable static.
      }
    }
    target.URL = Patched
    return { applied: true }
  } catch {
    return { applied: false }
  }
}

export { installUrlCompat, parseNonSpecial, needsRepair }
