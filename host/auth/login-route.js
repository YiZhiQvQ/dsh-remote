/**
 * The login and logout endpoints of the LAN gate.
 *
 * Kept apart from the proxy transport so the credential path can be tested
 * without opening a listener, and so `server.js` stays about bytes.
 *
 * @module dsh-remote/host/auth/login-route
 */
import { loginPage } from './login-page.js'
import { verifyPassword } from './password.js'
import {
  SESSION_COOKIE,
  clearCookie,
  cookieValue,
  createSession,
  safeNext,
  setCookie,
} from './session.js'
import { redirectTo as redirect } from '../http/respond.js'
import { debug } from '../log.js'

const BODY_LIMIT = 4096

/**
 * @param {import('node:http').IncomingMessage} request
 * @param {number} limit
 * @returns {Promise<string>}
 */
function readBody(request, limit) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    request.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('body too large'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    request.on('error', reject)
  })
}

/** @param {import('node:http').ServerResponse} response @param {number} status @param {string} text */
function sendText(response, status, text) {
  response.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
  response.end(text)
}

/** @param {import('node:http').ServerResponse} response @param {number} status @param {string} html */
function sendHtml(response, status, html) {
  response.writeHead(status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
  response.end(html)
}

/**
 * Build the login handler.
 *
 * @param {{
 *   path: string,
 *   sessionDays: number,
 *   secret: string,
 *   credentials: import('./credentials.js').Credentials,
 *   limiter: import('./rate-limit.js').RateLimiter,
 *   clientKey: (request: import('node:http').IncomingMessage) => string,
 *   currentSession: (request: import('node:http').IncomingMessage) => string|undefined,
 *   verifySession: (value: string|undefined) => boolean,
 *   ensureDshCookie: () => Promise<string|undefined>,
 *   counters: {authFailures: number, rateLimited: number},
 * }} deps
 */
function createLoginHandler(deps) {
  return async function handleLogin(request, response, url) {
    if (request.method === 'GET') {
      const session = cookieValue(request.headers.cookie, SESSION_COOKIE)
      if (deps.verifySession(session)) {
        redirect(response, '/')
        return
      }
      sendHtml(response, 200, loginPage(deps.path, {
        error: url.searchParams.get('error') === '1',
        next: safeNext(url.searchParams.get('next')),
        username: deps.credentials.username,
      }))
      return
    }
    if (request.method !== 'POST') {
      sendText(response, 405, 'method not allowed')
      return
    }
    const authority = request.headers.host || ''
    const origin = request.headers.origin
    if (origin !== undefined && origin !== 'http://' + authority) {
      sendText(response, 403, 'bad origin')
      return
    }
    let body
    try {
      body = await readBody(request, BODY_LIMIT)
    } catch {
      sendText(response, 413, 'body too large')
      return
    }
    const form = new URLSearchParams(body)
    const username = form.get('username') || ''
    const password = form.get('password') || ''
    const next = safeNext(form.get('next'))
    const key = deps.clientKey(request)

    if (deps.limiter.isBlocked(key)) {
      deps.counters.rateLimited += 1
      sendHtml(response, 429, loginPage(deps.path, { error: true, next, username, message: '尝试次数过多，请稍后再试' }))
      return
    }
    // Always run the KDF, even for an unknown user name: a fast rejection would
    // tell an attacker which half of the pair was wrong.
    const okPassword = await verifyPassword(deps.credentials, password)
    if (username !== deps.credentials.username || !okPassword) {
      deps.limiter.recordFailure(key)
      deps.counters.authFailures += 1
      redirect(response, deps.path + '?error=1&next=' + encodeURIComponent(next))
      return
    }
    const cookie = await deps.ensureDshCookie()
    if (cookie === undefined) {
      sendHtml(response, 503, loginPage(deps.path, { error: true, next, username, message: 'DSH 尚未就绪，请稍后重试' }))
      return
    }
    deps.limiter.clear(key)
    redirect(response, next, setCookie(createSession(deps.secret, deps.credentials, deps.sessionDays), deps.sessionDays))
  }
}

/** @param {import('node:http').ServerResponse} response @param {string} loginPath */
function sendLogout(response, loginPath) {
  redirect(response, loginPath, clearCookie())
}

export { createLoginHandler, sendLogout, readBody, sendText, sendHtml, BODY_LIMIT, debug }
