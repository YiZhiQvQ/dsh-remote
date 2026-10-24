/**
 * The single response helper set. Before this module the plugin carried three
 * copies of `textResponse` and two of `jsonResponse`; anything that answers a
 * browser answer goes through here.
 *
 * @module dsh-remote/host/http/respond
 */

/**
 * @param {unknown} value
 * @param {number} [status]
 * @param {Record<string,string>} [extra]
 * @returns {Response}
 */
function jsonResponse(value, status = 200, extra = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extra,
    },
  })
}

/**
 * @param {number} status
 * @param {string} text
 * @param {Record<string,string>} [extra]
 * @returns {Response}
 */
function textResponse(status, text, extra = {}) {
  return new Response(text, {
    status,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      ...extra,
    },
  })
}

/**
 * @param {number} status
 * @param {string} html
 * @returns {Response}
 */
function htmlResponse(status, html) {
  return new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

/**
 * A 303 redirect. Used by the gate for the post-login hop and the logout bounce.
 * @param {import('node:http').ServerResponse} response
 * @param {string} location
 * @param {string} [cookie] - a `set-cookie` value to attach.
 */
function redirectTo(response, location, cookie) {
  /** @type {Record<string, string>} */
  const headers = { location, 'cache-control': 'no-store' }
  if (cookie !== undefined) headers['set-cookie'] = cookie
  response.writeHead(303, headers)
  response.end()
}

/**
 * Read a Node error code without asserting the error's shape at every call site.
 * `error.code` is not part of `Error`; filesystem and stream errors carry it.
 *
 * @param {unknown} error
 * @returns {string|undefined}
 */
function errorCodeOf(error) {
  if (error === null || typeof error !== 'object') return undefined
  const code = /** @type {{code?: unknown}} */ (error).code
  return typeof code === 'string' ? code : undefined
}

export { jsonResponse, textResponse, htmlResponse, redirectTo, errorCodeOf }
