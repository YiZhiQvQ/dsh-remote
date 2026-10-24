/**
 * Authenticated download with byte-range support.
 *
 * The previous version stat'ed the path and then opened it by name, so the file
 * could be replaced between the two calls, and a phone could not seek inside a
 * large video. This opens once, serves from the descriptor, and answers Range,
 * If-None-Match and HEAD from the same stat.
 *
 * @module dsh-remote/host/routes/download
 */
import { createReadStream } from 'node:fs'
import { basename, extname, isAbsolute } from 'node:path'
import { Readable } from 'node:stream'
import { errorCodeOf, textResponse } from '../http/respond.js'
import { debug } from '../log.js'

const DEFAULT_MAX_DOWNLOAD_BYTES = 512 * 1024 * 1024

const MIME = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.zip': 'application/zip',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.bin': 'application/octet-stream',
}

/** @param {string} value */
function asciiFilename(value) {
  const name = String(value || 'download').replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_').trim()
  return name.length === 0 ? 'download' : name
}

/** @param {string} name */
function mimeOf(name) {
  return MIME[extname(name).toLowerCase()] || 'application/octet-stream'
}

/**
 * Parse a single-range `Range` header against a known size.
 * @param {string|undefined} header
 * @param {number} size
 * @returns {{start: number, end: number}|'invalid'|undefined}
 */
function parseRange(header, size) {
  if (typeof header !== 'string' || !header.startsWith('bytes=')) return undefined
  const spec = header.slice('bytes='.length).split(',')[0].trim()
  if (spec.length === 0) return 'invalid'
  const dash = spec.indexOf('-')
  if (dash === -1) return 'invalid'
  const startText = spec.slice(0, dash)
  const endText = spec.slice(dash + 1)
  if (startText.length === 0) {
    // Suffix form: last N bytes.
    const suffix = Number(endText)
    if (!Number.isInteger(suffix) || suffix <= 0) return 'invalid'
    return { start: Math.max(0, size - suffix), end: size - 1 }
  }
  const start = Number(startText)
  const end = endText.length === 0 ? size - 1 : Number(endText)
  if (!Number.isInteger(start) || !Number.isInteger(end)) return 'invalid'
  if (start >= size || end < start) return 'invalid'
  return { start, end: Math.min(end, size - 1) }
}

/**
 * @param {{fs: any, maxBytes?: number, rangeEnabled?: boolean}} options
 */
function createDownloadHandler(options) {
  const fs = options && options.fs
  const maxBytes = options && Number.isInteger(options.maxBytes) && options.maxBytes > 0 ? options.maxBytes : DEFAULT_MAX_DOWNLOAD_BYTES
  const rangeEnabled = options === undefined || options.rangeEnabled !== false

  return async function download(request) {
    if (!fs) return textResponse(500, 'filesystem unavailable')
    const url = new URL(request.url)
    const path = url.searchParams.get('path')
    if (path === null || path.length === 0 || path.includes('\0') || !isAbsolute(path)) return textResponse(400, 'absolute path required')
    try {
      const target = await fs.resolve(path, { signal: request.signal })
      const info = await fs.stat(target, request.signal)
      if (info === undefined) return textResponse(404, 'not found')
      if (info.type !== 'file') return textResponse(403, 'not a regular file')
      if (info.size !== undefined && info.size > maxBytes) return textResponse(413, 'file exceeds byte limit')
      const physical = target.displayPath === undefined ? path : target.displayPath
      const filename = basename(physical)
      const size = typeof info.size === 'number' ? info.size : undefined
      const etag = size === undefined ? undefined : 'W/"' + String(size) + '-' + String(info.mtimeMs === undefined ? 0 : Math.trunc(info.mtimeMs)) + '"'

      const headers = {
        'content-type': mimeOf(filename),
        'content-disposition': 'attachment; filename="' + asciiFilename(filename) + '"; filename*=UTF-8\'\'' + encodeURIComponent(filename),
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
        'content-security-policy': 'sandbox',
      }
      if (rangeEnabled) headers['accept-ranges'] = 'bytes'
      if (etag !== undefined) headers.etag = etag

      const ifNoneMatch = request.headers.get('if-none-match')
      if (etag !== undefined && ifNoneMatch !== null && ifNoneMatch === etag) {
        const notModified = { ...headers }
        delete notModified['content-type']
        if (size !== undefined) notModified['content-length'] = '0'
        return new Response(null, { status: 304, headers: notModified })
      }

      let range
      if (rangeEnabled && size !== undefined) {
        const ifRange = request.headers.get('if-range')
        const rangeAllowed = ifRange === null || etag === undefined || ifRange === etag
        if (rangeAllowed) range = parseRange(request.headers.get('range') || undefined, size)
      }
      if (range === 'invalid') {
        return new Response(null, { status: 416, headers: { ...headers, 'content-range': 'bytes */' + String(size) } })
      }

      if (range !== undefined) {
        headers['content-range'] = 'bytes ' + String(range.start) + '-' + String(range.end) + '/' + String(size)
        headers['content-length'] = String(range.end - range.start + 1)
      } else if (size !== undefined) {
        headers['content-length'] = String(size)
      }
      if (request.method === 'HEAD') return new Response(null, { status: range === undefined ? 200 : 206, headers })

      const stream = createReadStream(physical, range === undefined ? undefined : { start: range.start, end: range.end })
      request.signal.addEventListener('abort', () => stream.destroy(), { once: true })
      stream.on('error', (error) => debug('download', 'stream error: ' + String(errorCodeOf(error) || error)))
      // Node's web stream and the platform BodyInit are structurally compatible
      // but carry distinct declarations; the cast documents that boundary.
      return new Response(/** @type {any} */ (Readable.toWeb(stream)), { status: range === undefined ? 200 : 206, headers })
    } catch (error) {
      const code = errorCodeOf(error)
      const status = code === 'FS_NOT_FOUND' ? 404
        : code === 'FS_NOT_REGULAR_FILE' ? 403
        : code === 'FS_PERMISSION_DENIED' || code === 'FS_SANDBOX_DENIED' ? 403
        : code === 'FS_TOO_LARGE' ? 413
        : code === 'FS_ABORTED' ? 499
        : code === 'ENOENT' ? 404
        : 500
      return textResponse(status, code === undefined ? 'download failed' : String(code))
    }
  }
}

export { createDownloadHandler, parseRange, mimeOf, DEFAULT_MAX_DOWNLOAD_BYTES }
