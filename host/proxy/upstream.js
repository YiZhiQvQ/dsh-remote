/**
 * Outbound side of the proxy: the pooled agent, and the DSH cookie that stands
 * in for the browser's credentials.
 *
 * The cookie used to be cached forever and fetched once per concurrent miss.
 * It now carries an expiry parsed from the upstream `set-cookie`, shares one
 * in-flight exchange per target, and is invalidated by a 401 so a restarted DSH
 * recovers instead of serving "logged in but 401" until the plugin restarts.
 *
 * @module dsh-remote/host/proxy/upstream
 */
import { Agent, request as httpRequest } from 'node:http'
import { debug } from '../log.js'

const DEFAULT_COOKIE_TTL_MS = 10 * 60 * 1000

/**
 * @typedef {object} UpstreamTarget
 * @property {string} host
 * @property {number} port
 * @property {string} [token]
 * @property {string} authority
 */

/**
 * @param {{maxSockets?: number}} [options]
 */
function createUpstreamAgent(options = {}) {
  return new Agent({
    keepAlive: true,
    maxSockets: Number.isInteger(options.maxSockets) ? options.maxSockets : 64,
    keepAliveMsecs: 15000,
  })
}

/**
 * Parse the lifetime of a `set-cookie` value.
 * @param {string} cookie
 * @returns {number} epoch milliseconds
 */
function cookieExpiry(cookie) {
  const maxAge = /;\s*max-age=(\d+)/i.exec(cookie)
  if (maxAge !== null) return Date.now() + Number(maxAge[1]) * 1000
  const expires = /;\s*expires=([^;]+)/i.exec(cookie)
  if (expires !== null) {
    const at = Date.parse(expires[1])
    if (!Number.isNaN(at)) return at
  }
  return Date.now() + DEFAULT_COOKIE_TTL_MS
}

/**
 * @param {{agent: Agent, tokenTtlMs?: number, onAuthError?: (message: string|null) => void}} options
 */
function createDshCookieStore(options) {
  const onAuthError = typeof options.onAuthError === 'function' ? options.onAuthError : () => {}
  /** @type {Map<string, {value: string, expiresAt: number}>} */
  const store = new Map()
  /** @type {Map<string, Promise<string|undefined>>} */
  const inflight = new Map()

  function keyOf(target) {
    return target.host + ':' + String(target.port)
  }

  /**
   * Exchange the launch token for a host-bound `dsh-auth-*` cookie.
   * @param {UpstreamTarget} target
   * @returns {Promise<string|undefined>}
   */
  function exchange(target) {
    const current = store.get(keyOf(target))
    if (current !== undefined && current.expiresAt > Date.now()) return Promise.resolve(current.value)
    const key = keyOf(target)
    const pending = inflight.get(key)
    if (pending !== undefined) return pending
    if (!target.token) {
      onAuthError('dsh token missing')
      return Promise.resolve(undefined)
    }
    const promise = new Promise((resolve) => {
      const request = httpRequest({
        host: target.host,
        port: target.port,
        method: 'GET',
        path: '/?token=' + encodeURIComponent(target.token),
        headers: { host: target.authority },
        setHost: false,
        agent: options.agent,
      }, (response) => {
        const header = response.headers['set-cookie']
        const list = Array.isArray(header) ? header : header ? [header] : []
        const auth = list.find((item) => item.startsWith('dsh-auth-'))
        response.resume()
        if (auth !== undefined) {
          const value = auth.split(';')[0]
          store.set(key, { value, expiresAt: cookieExpiry(auth) })
          onAuthError(null)
          debug('upstream', 'dsh cookie acquired for ' + key)
          resolve(value)
        } else {
          onAuthError('no dsh-auth cookie (HTTP ' + String(response.statusCode) + ')')
          resolve(undefined)
        }
      })
      request.on('error', (error) => {
        const code = error !== null && typeof error === 'object' && 'code' in error ? /** @type {{code?: string}} */ (error).code : undefined
        onAuthError('token request failed: ' + String(code || error))
        resolve(undefined)
      })
      request.end()
    }).finally(() => {
      inflight.delete(key)
    })
    inflight.set(key, promise)
    return promise
  }

  return {
    /**
     * @param {UpstreamTarget} target
     * @returns {Promise<string|undefined>}
     */
    get(target) {
      const current = store.get(keyOf(target))
      if (current !== undefined && current.expiresAt > Date.now()) return Promise.resolve(current.value)
      return exchange(target)
    },
    /** Force a refresh after an upstream 401. */
    invalidate(target) {
      store.delete(keyOf(target))
    },
    /** Test seam: drop everything. */
    clear() {
      store.clear()
      inflight.clear()
    },
    expiryOf(target) {
      const current = store.get(keyOf(target))
      return current === undefined ? undefined : current.expiresAt
    },
  }
}

export { createDshCookieStore, createUpstreamAgent, cookieExpiry, DEFAULT_COOKIE_TTL_MS }
