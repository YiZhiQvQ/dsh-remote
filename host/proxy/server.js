/**
 * The LAN reverse proxy: one listener, one gate, one lifecycle.
 *
 * Invariants worth keeping in view when editing this file:
 * - The DSH launch token never reaches the browser. The proxy exchanges it for a
 *   host-bound `dsh-auth-*` cookie and keeps that cookie in memory.
 * - Upstream `set-cookie` for `dsh-auth-*` is removed before the response is
 *   written, so the browser only ever holds `dsh-remote-session`.
 * - Host and Origin are rewritten to the loopback authority, which is what makes
 *   DSH's own browser-trust fence accept the forwarded request.
 *
 * Header rewriting lives in `forward.js`; this module owns the socket, the route
 * table and the state machine.
 *
 * @module dsh-remote/host/proxy/server
 */
import { createServer } from 'node:http'
import { createDshCookieStore, createUpstreamAgent } from './upstream.js'
import { authorize } from './authorize.js'
import { forward, forwardUpgrade, filterSetCookie, stripHopByHop } from './forward.js'
import { closeListener } from './shutdown.js'
import { loadCredentials } from '../auth/credentials.js'
import { createLoginHandler, sendLogout, sendText } from '../auth/login-route.js'
import { createRateLimiter } from '../auth/rate-limit.js'
import { SESSION_COOKIE, cookieValue, loadSecret, verifySession, DEFAULT_SESSION_DAYS } from '../auth/session.js'
import { lanSnapshot } from '../lan.js'
import { redirectTo as redirect } from '../http/respond.js'
import { debug, warn } from '../log.js'

const LOGIN_PATH = '/__dsh_remote/login'
const LOGOUT_PATH = '/__dsh_remote/logout'
const HEALTH_PATH = '/__dsh_remote/health'

/**
 * Public, non-secret assets. A manifest or favicon fetch is credentials-omitted
 * by the browser, so it never carries the LAN session cookie; forwarding them
 * with the proxy-held cookie is what lets an installed phone shell keep its name
 * and icon.
 */
const PUBLIC_ASSETS = new Set(['/manifest.webmanifest', '/favicon.svg', '/favicon-dark.svg'])

/**
 * @typedef {object} ProxyOptions
 * @property {number} listenPort
 * @property {string} [targetHost]
 * @property {number} targetPort
 * @property {string} [dshToken]
 * @property {string} [secretFile]
 * @property {string} [username]
 * @property {string} [password]
 * @property {string} [authFile]
 * @property {string[]} [allowedHosts]
 * @property {number} [sessionDays]
 * @property {number} [keepAliveMaxSockets]
 * @property {boolean} [trustProxyHeaders]
 */

/**
 * Start the LAN reverse proxy.
 * @param {ProxyOptions} options
 */
function startLanProxy(options) {
  const listenPort = Number(options.listenPort)
  const targetHost = options.targetHost || '127.0.0.1'
  const targetPort = Number(options.targetPort)
  const sessionDays = Number.isInteger(options.sessionDays) ? options.sessionDays : DEFAULT_SESSION_DAYS
  const allowedHosts = Array.isArray(options.allowedHosts) ? options.allowedHosts : []
  const trustProxyHeaders = options.trustProxyHeaders === true

  const credentials = loadCredentials(options)
  const secret = loadSecret(options.secretFile)
  const agent = createUpstreamAgent({ maxSockets: options.keepAliveMaxSockets })
  const limiter = createRateLimiter()
  const counters = { authFailures: 0, rateLimited: 0 }

  const target = {
    host: targetHost,
    port: targetPort,
    token: options.dshToken,
    authority: targetHost + ':' + String(targetPort),
  }

  const state = {
    phase: 'stopped',
    error: null,
    listenPort,
    targetHost,
    targetPort,
    username: credentials.username,
    authSource: credentials.source,
    hasToken: Boolean(options.dshToken),
    lastAuthError: null,
    requests: 0,
    upstreamErrors: 0,
    authFailures: 0,
    rateLimited: 0,
    startedAt: 0,
  }

  const cookies = createDshCookieStore({
    agent,
    onAuthError: (message) => {
      state.lastAuthError = message
    },
  })

  /** @type {import('node:http').Server|undefined} */
  let server
  /** @type {Promise<boolean>|undefined} */
  let starting
  /** @type {Set<import('node:stream').Duplex>} */
  const upgraded = new Set()

  /**
   * The authority set the Host fence checks against. Derived from the cached LAN
   * sample, so the request path never probes the OS and still follows a network
   * change within one TTL.
   * @returns {Set<string>}
   */
  function currentAuthorities() {
    const values = new Set()
    for (const row of lanSnapshot()) values.add(row.address + ':' + String(listenPort))
    values.add('127.0.0.1:' + String(listenPort))
    values.add('localhost:' + String(listenPort))
    return values
  }

  function authOptions() {
    return { authorities: currentAuthorities(), allowedHosts, credentials, secret }
  }

  /**
   * @param {import('node:http').IncomingMessage} request
   * @returns {string}
   */
  function clientKey(request) {
    if (trustProxyHeaders) {
      const forwarded = request.headers['x-forwarded-for']
      const first = Array.isArray(forwarded) ? forwarded[0] : forwarded
      if (typeof first === 'string' && first.length > 0) return first.split(',')[0].trim()
    }
    const address = request.socket.remoteAddress || 'unknown'
    return address.startsWith('::ffff:') ? address.slice(7) : address
  }

  const handleLogin = createLoginHandler({
    path: LOGIN_PATH,
    sessionDays,
    secret,
    credentials,
    limiter,
    clientKey,
    currentSession: (request) => cookieValue(request.headers.cookie, SESSION_COOKIE),
    verifySession: (session) => verifySession(secret, credentials, session),
    ensureDshCookie: () => cookies.get(target),
    counters,
  })

  /**
   * @param {import('node:http').IncomingMessage} request
   * @param {import('node:http').ServerResponse} response
   * @param {URL} url
   */
  async function handleRequest(request, response, url) {
    state.requests += 1
    if (url.pathname === LOGIN_PATH) {
      await handleLogin(request, response, url)
      return
    }
    if (url.pathname === LOGOUT_PATH) {
      sendLogout(response, LOGIN_PATH)
      return
    }
    const verdict = authorize(request, authOptions())
    if (verdict.ok === false) {
      // A manifest or favicon fetch is credentials-omitted by the browser, so it
      // never carries the session cookie. These are public, non-secret assets:
      // keep the Host fence (a 403 is still a 403) but let the missing session
      // through, or an installed phone shell loses its name and icon.
      if (verdict.status === 401 && PUBLIC_ASSETS.has(url.pathname)) {
        await proxyToDsh(request, response, true)
        return
      }
      if (verdict.status === 401 && String(request.headers.accept || '').includes('text/html')) {
        redirect(response, LOGIN_PATH + '?next=' + encodeURIComponent(request.url || '/'))
        return
      }
      sendText(response, verdict.status, verdict.reason)
      return
    }
    if (url.pathname === HEALTH_PATH) {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      response.end(JSON.stringify({ ok: true, running: state.phase === 'running', requests: state.requests }))
      return
    }
    await proxyToDsh(request, response, PUBLIC_ASSETS.has(url.pathname))
  }

  /**
   * Send the request upstream with the proxy-held cookie.
   * @param {import('node:http').IncomingMessage} request
   * @param {import('node:http').ServerResponse} response
   * @param {boolean} allowMissingCookie - public assets keep working when DSH is
   *   still starting and no cookie has been obtained yet.
   */
  async function proxyToDsh(request, response, allowMissingCookie) {
    const dshCookie = await cookies.get(target)
    if (dshCookie === undefined && !allowMissingCookie) {
      sendText(response, 503, 'DSH authentication unavailable')
      return
    }
    forward({
      request,
      response,
      target,
      dshCookie,
      agent,
      onUpstreamError: () => {
        state.upstreamErrors += 1
      },
      onUnauthorized: () => cookies.invalidate(target),
    })
  }

  /**
   * @param {import('node:http').IncomingMessage} request
   * @param {import('node:stream').Duplex} socket
   * @param {Buffer} head
   */
  async function handleUpgrade(request, socket, head) {
    const verdict = authorize(request, authOptions())
    if (verdict.ok === false) {
      socket.end('HTTP/1.1 ' + String(verdict.status) + (verdict.status === 401 ? ' Unauthorized' : ' Forbidden') + '\r\n\r\n')
      return
    }
    const dshCookie = await cookies.get(target)
    if (dshCookie === undefined) {
      socket.end('HTTP/1.1 503 Service Unavailable\r\n\r\n')
      return
    }
    forwardUpgrade({ request, socket, head, target, dshCookie })
  }

  /**
   * Tear the listener down; see `shutdown.js` for the two modes.
   * @param {{drain?: boolean}} [options]
   * @returns {Promise<void>}
   */
  function closeNow(options = {}) {
    const instance = server
    server = undefined
    if (instance === undefined) {
      state.phase = 'stopped'
      return Promise.resolve()
    }
    state.phase = 'stopping'
    return closeListener(instance, {
      drain: options.drain === true,
      upgraded,
      onStopped: () => {
        state.phase = 'stopped'
      },
    })
  }

  return {
    state,
    get server() {
      return server
    },
    agent,
    cookies,
    limiter,
    start() {
      if (state.phase === 'running') return Promise.resolve(true)
      // A second caller joins the listen already in flight instead of racing it
      // into EADDRINUSE.
      if (starting !== undefined) return starting
      state.phase = 'starting'
      starting = new Promise((resolve) => {
        const instance = createServer((request, response) => {
          let url
          try {
            url = new URL(request.url || '/', 'http://' + (request.headers.host || 'localhost'))
          } catch {
            sendText(response, 400, 'bad request')
            return
          }
          handleRequest(request, response, url).catch((error) => {
            debug('proxy', 'request failed: ' + String(error))
            if (!response.headersSent) sendText(response, 500, 'dsh-remote proxy error')
            else response.destroy()
          })
        })
        instance.headersTimeout = 30000
        instance.requestTimeout = 0
        instance.keepAliveTimeout = 5000
        instance.on('upgrade', (request, socket, head) => {
          upgraded.add(socket)
          socket.once('close', () => upgraded.delete(socket))
          handleUpgrade(request, socket, head).catch(() => {
            try {
              socket.destroy()
            } catch {
              // Already closed.
            }
          })
        })
        instance.on('clientError', (_error, socket) => {
          if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
        })
        const onError = (error) => {
          if (state.phase === 'starting') {
            state.phase = 'error'
            state.error = (error && error.message) || String(error)
            warn('proxy listen failed: ' + state.error)
          }
          resolve(false)
        }
        instance.once('error', onError)
        try {
          instance.listen(listenPort, '0.0.0.0', () => {
            instance.off('error', onError)
            const address = instance.address()
            if (address !== null && typeof address === 'object') state.listenPort = address.port
            state.phase = 'running'
            state.error = null
            state.startedAt = Date.now()
            server = instance
            debug('proxy', 'listening on 0.0.0.0:' + String(state.listenPort))
            resolve(true)
          })
        } catch (error) {
          onError(error)
        }
      }).finally(() => {
        starting = undefined
      })
      return starting
    },
    /**
     * @param {{drain?: boolean}} [options]
     * @returns {Promise<void>} settles once the port is released
     */
    close(options = {}) {
      // A close issued while a listen is still in flight must wait for that
      // listen to settle, or the socket it opens lands after we have already
      // reported "stopped" and the next start() races it into EADDRINUSE.
      const pending = starting
      if (pending === undefined) return closeNow(options)
      return pending.catch(() => {}).then(() => closeNow(options))
    },
    /** Release timers and pooled sockets; the server must be closed first. */
    dispose() {
      limiter.stop()
      agent.destroy()
      cookies.clear()
    },
  }
}

export { startLanProxy, LOGIN_PATH, LOGOUT_PATH, HEALTH_PATH, stripHopByHop, filterSetCookie }
export { forward }
