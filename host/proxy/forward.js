/**
 * The two forwarding paths: a pooled HTTP request and an exclusive upgrade.
 *
 * Kept apart from the listener so the header rewriting rules — which are the
 * security-relevant part — can be read and tested without a server.
 *
 * @module dsh-remote/host/proxy/forward
 */
import { request as httpRequest } from 'node:http'
import { stripAuthCookies } from '../auth/session.js'
import { debug } from '../log.js'

/** Headers that describe one hop and must not be forwarded. */
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

/**
 * @param {import('node:http').IncomingHttpHeaders} headers
 * @returns {import('node:http').OutgoingHttpHeaders}
 */
function stripHopByHop(headers) {
  /** @type {import('node:http').OutgoingHttpHeaders} */
  const out = {}
  for (const [key, value] of Object.entries(headers)) {
    if (HOP_BY_HOP.has(key.toLowerCase())) continue
    out[key] = value
  }
  return out
}

/**
 * Remove the DSH auth cookie from an upstream `set-cookie` list so the browser
 * keeps only the plugin session. Everything else passes through untouched.
 * @param {unknown} header
 * @returns {string[]|undefined}
 */
function filterSetCookie(header) {
  if (header === undefined || header === null) return undefined
  const list = Array.isArray(header) ? header.map((entry) => String(entry)) : [String(header)]
  const kept = list.filter((entry) => !entry.trimStart().toLowerCase().startsWith('dsh-auth-'))
  return kept.length === 0 ? undefined : kept
}

/**
 * Compose the headers an upstream request carries.
 *
 * The browser's own auth cookies are removed and the proxy-held DSH cookie is
 * substituted; Host and Origin become the loopback authority so DSH's fence sees
 * a request it trusts without the fence being widened for the LAN.
 *
 * @param {import('node:http').IncomingMessage} request
 * @param {string|undefined} dshCookie
 * @param {string} authority
 * @returns {import('node:http').OutgoingHttpHeaders}
 */
function upstreamHeaders(request, dshCookie, authority) {
  const headers = stripHopByHop(request.headers)
  const browserCookie = stripAuthCookies(request.headers.cookie)
  const cookie = [browserCookie, dshCookie].filter(Boolean).join('; ')
  if (cookie) headers.cookie = cookie
  else delete headers.cookie
  headers.host = authority
  if (headers.origin !== undefined) headers.origin = 'http://' + authority
  return headers
}

/**
 * Forward one HTTP request to DSH.
 *
 * @param {{
 *   request: import('node:http').IncomingMessage,
 *   response: import('node:http').ServerResponse,
 *   target: {host: string, port: number, authority: string},
 *   dshCookie: string|undefined,
 *   agent: import('node:http').Agent,
 *   onUpstreamError: (error: unknown) => void,
 *   onUnauthorized: () => void,
 * }} deps
 */
function forward(deps) {
  const { request, response, target, dshCookie, agent } = deps
  const headers = upstreamHeaders(request, dshCookie, target.authority)
  const upstream = httpRequest({
    host: target.host,
    port: target.port,
    method: request.method,
    path: request.url,
    headers,
    setHost: false,
    agent,
  }, (upstreamResponse) => {
    const responseHeaders = stripHopByHop(upstreamResponse.headers)
    const setCookie = filterSetCookie(upstreamResponse.headers['set-cookie'])
    if (setCookie === undefined) delete responseHeaders['set-cookie']
    else responseHeaders['set-cookie'] = setCookie
    if (upstreamResponse.statusCode === 401) deps.onUnauthorized()
    if (upstreamResponse.statusMessage) {
      response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.statusMessage, responseHeaders)
    } else {
      response.writeHead(upstreamResponse.statusCode || 502, responseHeaders)
    }
    upstreamResponse.pipe(response)
  })
  upstream.on('error', (error) => {
    deps.onUpstreamError(error)
    debug('proxy', 'upstream error: ' + String(error))
    if (!response.headersSent) {
      response.writeHead(502, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
      response.end('dsh-remote proxy: upstream unavailable')
    } else {
      response.destroy()
    }
  })
  response.on('close', () => {
    if (!response.writableFinished) upstream.destroy()
  })
  request.pipe(upstream)
}

/**
 * Forward a WebSocket upgrade. An upgrade owns its socket, so it cannot use the
 * keep-alive pool.
 *
 * @param {{
 *   request: import('node:http').IncomingMessage,
 *   socket: import('node:stream').Duplex,
 *   head: Buffer,
 *   target: {host: string, port: number, authority: string},
 *   dshCookie: string|undefined,
 * }} deps
 */
function forwardUpgrade(deps) {
  const { request, socket, head, target, dshCookie } = deps
  const headers = upstreamHeaders(request, dshCookie, target.authority)
  // The upgrade handshake needs these two, so they are restored by hand after
  // the hop-by-hop sweep.
  delete headers.upgrade
  headers.upgrade = request.headers.upgrade
  delete headers.connection
  headers.connection = 'Upgrade'
  const upstream = httpRequest({
    host: target.host,
    port: target.port,
    method: request.method,
    path: request.url,
    headers,
    setHost: false,
    agent: false,
  })
  upstream.on('upgrade', (upstreamResponse, upstreamSocket, upstreamHead) => {
    socket.once('close', () => upstreamSocket.destroy())
    upstreamSocket.once('close', () => socket.destroy())
    socket.write(responseHead(upstreamResponse))
    if (upstreamHead && upstreamHead.length > 0) socket.write(upstreamHead)
    upstreamSocket.pipe(socket)
    socket.pipe(upstreamSocket)
    upstreamSocket.on('error', () => socket.destroy())
    socket.on('error', () => upstreamSocket.destroy())
  })
  upstream.on('response', (upstreamResponse) => {
    socket.write(responseHead(upstreamResponse))
    upstreamResponse.pipe(socket)
  })
  upstream.on('error', () => {
    if (socket.writable) socket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n')
  })
  upstream.end(head)
}

/** @param {import('node:http').IncomingMessage} response */
function responseHead(response) {
  let head = 'HTTP/1.1 ' + String(response.statusCode || 502) + ' ' + String(response.statusMessage || '') + '\r\n'
  for (let index = 0; index < response.rawHeaders.length; index += 2) {
    head += response.rawHeaders[index] + ': ' + response.rawHeaders[index + 1] + '\r\n'
  }
  return head + '\r\n'
}

export { stripHopByHop, filterSetCookie, upstreamHeaders, forward, forwardUpgrade, responseHead, HOP_BY_HOP }
