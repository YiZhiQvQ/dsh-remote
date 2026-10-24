/**
 * One authorization pipeline for both HTTP requests and WebSocket upgrades.
 *
 * These used to be two near-identical blocks that had already drifted apart
 * (the host-application rule only existed on the HTTP side). Both now ask the
 * same function and act on its verdict.
 *
 * @module dsh-remote/host/proxy/authorize
 */
import { SESSION_COOKIE, cookieValue, verifySession } from '../auth/session.js'
import { isPrivateIpLiteral, splitAuthority } from '../lan.js'

/**
 * @typedef {object} AuthorizeOptions
 * @property {Set<string>} authorities - `host:port` values derived from the LAN snapshot.
 * @property {string[]} allowedHosts - extra hostnames or authorities from config.
 * @property {import('../auth/credentials.js').Credentials} credentials
 * @property {string} secret
 */

/**
 * Whether a Host header may address this proxy.
 *
 * Two arms, cheapest first: an IP literal in a private range is accepted by
 * regex alone (a rebound DNS name can never satisfy it), then the derived
 * authority set and any configured extras. Neither arm touches
 * `os.networkInterfaces()`.
 *
 * @param {string} authority
 * @param {AuthorizeOptions} options
 * @returns {boolean}
 */
function hostAllowed(authority, options) {
  if (typeof authority !== 'string' || authority.length === 0) return false
  if (options.authorities.has(authority)) return true
  const { hostname } = splitAuthority(authority)
  const bare = hostname.replace(/^\[|\]$/g, '')
  if (isPrivateIpLiteral(bare)) return true
  return options.allowedHosts.includes(hostname) || options.allowedHosts.includes(authority)
}

/**
 * @typedef {{ok: true, session: string|undefined} | {ok: false, status: number, reason: string}} Verdict
 */

/**
 * @param {import('node:http').IncomingMessage} request
 * @param {AuthorizeOptions} options
 * @returns {Verdict}
 */
function authorize(request, options) {
  const authority = request.headers.host || ''
  if (!hostAllowed(authority, options)) {
    return { ok: false, status: 403, reason: 'forbidden host' }
  }
  const session = cookieValue(request.headers.cookie, SESSION_COOKIE)
  if (!verifySession(options.secret, options.credentials, session)) {
    return { ok: false, status: 401, reason: 'login required' }
  }
  return { ok: true, session }
}

export { authorize, hostAllowed }
