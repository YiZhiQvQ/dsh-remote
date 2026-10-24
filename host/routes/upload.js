/**
 * Streamed upload into a directory the operator can already see in the Files tab.
 *
 * Two things changed from the first version:
 *
 * 1. The temporary file no longer lands beside the user's files as
 *    `.dsh-remote-upload-<hex>.part`. Writes go to one hidden sibling directory
 *    (`.dsh-remote-tmp`) on the same volume, so the rename stays atomic and the
 *    file listing never shows a half-written artefact.
 * 2. The final name is claimed with `open(..., 'wx')` instead of stat-then-rename,
 *    which removes the window where two concurrent uploads pick the same target.
 *
 * @module dsh-remote/host/routes/upload
 */
import { randomBytes } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, open, readdir, rename, rm, stat, unlink } from 'node:fs/promises'
import { dirname, extname, isAbsolute, join, resolve } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { errorCodeOf, jsonResponse, textResponse } from '../http/respond.js'
import { debug } from '../log.js'

const DEFAULT_MAX_UPLOAD_BYTES = 512 * 1024 * 1024
const DEFAULT_TEMP_SUBDIR = '.dsh-remote-tmp'
const DEFAULT_TEMP_TTL_MS = 60 * 60 * 1000
const MAX_NAME_ATTEMPTS = 1000
const WINDOWS_ABSOLUTE = /^(?:[A-Za-z]:[\\/]|[\\/]{2}[^\\/]+[\\/]+[^\\/]+)/
const WINDOWS_RESERVED = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i

/**
 * A fully qualified path, in the same sense the Host browse picker uses.
 * @param {unknown} value
 * @returns {boolean}
 */
function isFullyQualifiedPath(value) {
  const path = String(value || '')
  if (path.length === 0) return false
  return process.platform === 'win32' ? WINDOWS_ABSOLUTE.test(path) : isAbsolute(path)
}

/**
 * @param {unknown} name
 * @returns {string|undefined}
 */
function safeSegment(name) {
  const value = String(name === undefined || name === null ? '' : name)
  if (value.length === 0 || value.length > 200) return undefined
  if (value === '.' || value === '..') return undefined
  if (/[\u0000-\u001f\u007f]/.test(value)) return undefined
  if (/[\\/]/.test(value)) return undefined
  if (process.platform === 'win32') {
    if (/[<>:"|?*]/.test(value)) return undefined
    if (/[. ]$/.test(value)) return undefined
    if (WINDOWS_RESERVED.test(value)) return undefined
  }
  return value
}

/**
 * Claim a file name by creating it exclusively, then close it again.
 *
 * The exclusive create is what makes concurrent uploads pick different names;
 * the zero-byte placeholder is the reservation. It has to be closed before the
 * rename: Windows refuses to replace a file that is still open, and even on
 * POSIX holding the descriptor would pin the inode we are about to replace.
 *
 * @param {string} directory
 * @param {string} name
 * @returns {Promise<{path: string, name: string}>}
 */
async function claimTarget(directory, name) {
  const extension = extname(name)
  const stem = extension.length > 0 ? name.slice(0, name.length - extension.length) : name
  for (let index = 0; index < MAX_NAME_ATTEMPTS; index += 1) {
    const candidate = index === 0 ? name : stem + ' (' + String(index) + ')' + extension
    const path = join(directory, candidate)
    let handle
    try {
      handle = await open(path, 'wx')
    } catch (error) {
      if (error && error.code === 'EEXIST') continue
      throw error
    }
    await handle.close()
    return { path, name: candidate }
  }
  throw new Error('too many files with the same name')
}

/**
 * Delete temporary files older than the TTL. Runs opportunistically on upload,
 * so a crashed process cannot leave the workspace with hidden garbage forever.
 *
 * @param {string} tempDir
 * @param {number} ttlMs
 */
async function sweepTemp(tempDir, ttlMs) {
  let entries
  try {
    entries = await readdir(tempDir)
  } catch {
    return
  }
  const now = Date.now()
  for (const entry of entries) {
    const path = join(tempDir, entry)
    try {
      const info = await stat(path)
      if (now - info.mtimeMs > ttlMs) await unlink(path)
    } catch {
      // Another upload may have consumed it; nothing to do.
    }
  }
}

/**
 * @param {{maxBytes?: number, tempSubdir?: string, tempTtlMs?: number}} [options]
 */
function createUploadHandler(options = {}) {
  const maxBytes = Number.isInteger(options.maxBytes) && options.maxBytes > 0 ? options.maxBytes : DEFAULT_MAX_UPLOAD_BYTES
  const tempSubdir = typeof options.tempSubdir === 'string' && options.tempSubdir.length > 0 ? options.tempSubdir : DEFAULT_TEMP_SUBDIR
  const tempTtlMs = Number.isInteger(options.tempTtlMs) && options.tempTtlMs > 0 ? options.tempTtlMs : DEFAULT_TEMP_TTL_MS

  return async function upload(request) {
    if (request.method !== 'POST') return textResponse(405, 'method not allowed')
    const contentType = String(request.headers.get('content-type') || '').split(';', 1)[0].trim().toLowerCase()
    if (contentType !== 'application/octet-stream') return textResponse(415, 'content type must be application/octet-stream')
    const url = new URL(request.url)
    const requested = url.searchParams.get('path')
    const name = safeSegment(url.searchParams.get('name'))
    if (requested === null || !isFullyQualifiedPath(requested) || requested.includes('\0')) {
      return textResponse(400, 'absolute directory path required')
    }
    if (name === undefined) return textResponse(400, 'valid file name required')
    if (request.body === null) return textResponse(400, 'request body required')

    let directory = resolve(requested)
    try {
      const info = await stat(directory)
      if (!info.isDirectory()) directory = dirname(directory)
    } catch {
      return textResponse(404, 'directory not found')
    }

    let target
    try {
      target = await claimTarget(directory, name)
    } catch {
      return textResponse(500, 'could not allocate a file name')
    }

    const tempDir = join(directory, tempSubdir)
    const temporary = join(tempDir, randomBytes(8).toString('hex') + '.part')
    let size = 0
    let committed = false
    try {
      await mkdir(tempDir, { recursive: true })
      void sweepTemp(tempDir, tempTtlMs)
      const limiter = new Transform({
        transform(chunk, _encoding, callback) {
          size += chunk.length
          if (size > maxBytes) {
            callback(Object.assign(new Error('file exceeds byte limit'), { code: 'FS_TOO_LARGE' }))
            return
          }
          callback(null, chunk)
        },
      })
      await pipeline(Readable.fromWeb(request.body), limiter, createWriteStream(temporary, { flags: 'wx' }))
      await rename(temporary, target.path)
      committed = true
      return jsonResponse({ ok: true, path: target.path, name: target.name, size })
    } catch (error) {
      await unlink(temporary).catch(() => {})
      if (size > maxBytes || (error && error.code === 'FS_TOO_LARGE')) return textResponse(413, 'file exceeds byte limit')
      const code = errorCodeOf(error)
      if (code === 'ENOSPC') return textResponse(507, 'insufficient storage')
      if (code === 'EXDEV') {
        // Should not happen: the temp directory is always a sibling. Kept as a
        // diagnostic instead of a silent retry that could double the disk usage.
        debug('upload', 'cross-device rename refused for ' + target.name)
        return textResponse(500, 'cross-device upload unsupported')
      }
      return textResponse(500, 'upload failed')
    } finally {
      if (!committed) await rm(target.path, { force: true }).catch(() => {})
    }
  }
}

export { createUploadHandler, safeSegment, claimTarget, sweepTemp, isFullyQualifiedPath, DEFAULT_MAX_UPLOAD_BYTES, DEFAULT_TEMP_SUBDIR }
