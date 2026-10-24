/**
 * Remote-only directory browser for the workspace picker.
 *
 * The host's `directory-picker-auto` chooses the native OS dialog, which a
 * phone cannot answer. The client half patches `uiWorkspace.pickDirectory`
 * on a LAN page and drives this route instead; the local desktop window keeps
 * the native chooser untouched.
 *
 * The listing mirrors `dsh-host-directory-picker-browse`: one level at a time,
 * child directories only (symlinks followed), hidden entries flagged, a bounded
 * window so a huge level cannot exhaust memory, and breadcrumbs from the root.
 *
 * @module dsh-remote/host/routes/browse
 */
import { mkdir, opendir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, join, posix, resolve, win32 } from 'node:path'
import { errorCodeOf, jsonResponse, textResponse } from '../http/respond.js'
import { debug } from '../log.js'

const MAX_ENTRIES = 1000
const WINDOWS_ABSOLUTE = /^(?:[A-Za-z]:[\\/]|[\\/]{2}[^\\/]+[\\/]+[^\\/]+)/
const DRIVE_LETTERS = 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

/** @type {{at: number, roots: Array<{name: string, path: string}>}} */
let rootsCache = { at: 0, roots: [] }

/**
 * Resolve a promise against a short deadline. A disconnected network drive can
 * make stat() hang; the drive picker must still open.
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @returns {Promise<T>}
 */
function withTimeout(promise, ms) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/**
 * Existing drive roots on Windows. Cached briefly: a directory listing should
 * not probe 26 letters on every navigation.
 * @returns {Promise<Array<{name: string, path: string}>>}
 */
async function driveRoots() {
  if (process.platform !== 'win32') return []
  const now = Date.now()
  if (now - rootsCache.at < 5000) return rootsCache.roots
  const roots = []
  await Promise.all(DRIVE_LETTERS.map(async (letter) => {
    const path = letter + ':\\'
    try {
      const info = await withTimeout(stat(path), 300)
      if (info.isDirectory()) roots.push({ name: letter + ':', path })
    } catch {
      // Absent, disconnected, or too slow: not a usable root.
    }
  }))
  roots.sort((a, b) => a.name.localeCompare(b.name))
  rootsCache = { at: now, roots }
  return roots
}

/**
 * A fixed filesystem location: POSIX-absolute on POSIX; on Windows only a
 * drive-qualified or complete UNC path (a rooted drive-less path would resolve
 * against the process's current drive).
 * @param {string} path
 * @returns {boolean}
 */
function fullyQualified(path) {
  if (path.length === 0) return false
  return process.platform === 'win32'
    ? win32.isAbsolute(path) && WINDOWS_ABSOLUTE.test(path)
    : posix.isAbsolute(path)
}

/**
 * Ancestor chain from the filesystem root to `target` inclusive.
 * @param {string} target
 */
function ancestryCrumbs(target) {
  const crumbs = []
  let current = target
  for (;;) {
    const parent = dirname(current)
    crumbs.unshift({ name: parent === current ? current : basename(current), path: current, hidden: false })
    if (parent === current) return crumbs
    current = parent
  }
}

/**
 * Insert a candidate into the name-sorted bounded window.
 * @param {Array<{name: string, isDirectory: boolean, isSymbolicLink: boolean}>} window
 * @param {{name: string, isDirectory: boolean, isSymbolicLink: boolean}} candidate
 * @param {number} keep
 * @returns {boolean} whether an eviction happened
 */
function boundedInsert(window, candidate, keep) {
  if (window.length === keep && candidate.name.localeCompare(window[window.length - 1].name) >= 0) return true
  let lo = 0
  let hi = window.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (candidate.name.localeCompare(window[mid].name) < 0) hi = mid
    else lo = mid + 1
  }
  window.splice(lo, 0, candidate)
  if (window.length <= keep) return false
  window.pop()
  return true
}

/**
 * One listing row for a dirent, following symlinks to directories; null for
 * non-directories and broken links.
 */
async function directoryRow(parent, name, isDirectory, isSymbolicLink, signal) {
  const path = join(parent, name)
  let enterable = isDirectory
  if (!enterable && isSymbolicLink) {
    try {
      enterable = (await stat(path)).isDirectory()
    } catch {
      if (signal?.aborted) throw signal.reason
      return null
    }
  }
  if (!enterable) return null
  return { name, path, hidden: name.startsWith('.') }
}

/**
 * List one level. `path` absent means the operator's home.
 * @param {string|undefined} path
 * @param {AbortSignal|undefined} signal
 */
async function list(path, signal) {
  const home = homedir()
  if (path !== undefined && !fullyQualified(path)) {
    throw Object.assign(new Error('absolute path required'), { code: 'EINVAL' })
  }
  const target = resolve(path === undefined ? home : path)
  const keep = MAX_ENTRIES + 1
  const window = []
  let evicted = false
  let level
  try {
    level = await opendir(target)
  } catch (error) {
    throw error
  }
  try {
    for (;;) {
      if (signal?.aborted) throw signal.reason
      const dirent = await level.read()
      if (dirent === null) break
      if (!dirent.isDirectory() && !dirent.isSymbolicLink()) continue
      if (boundedInsert(window, {
        name: dirent.name,
        isDirectory: dirent.isDirectory(),
        isSymbolicLink: dirent.isSymbolicLink(),
      }, keep)) evicted = true
    }
  } finally {
    await level.close().catch(() => {})
  }
  const entries = []
  let truncated = evicted
  for (const candidate of window) {
    if (signal?.aborted) throw signal.reason
    const row = await directoryRow(target, candidate.name, candidate.isDirectory, candidate.isSymbolicLink, signal)
    if (row === null) continue
    if (entries.length === MAX_ENTRIES) {
      truncated = true
      break
    }
    entries.push(row)
  }
  return { path: target, home, crumbs: ancestryCrumbs(target), entries, truncated, roots: await driveRoots() }
}

/**
 * Create one child directory. `name` must be a single segment.
 * @param {string} parent
 * @param {string} name
 */
async function createDirectory(parent, name) {
  if (!fullyQualified(parent)) {
    throw Object.assign(new Error('absolute parent path required'), { code: 'EINVAL' })
  }
  const base = resolve(parent)
  if (name.trim() === '' || name === '.' || name === '..' || /[\\/]/.test(name)) {
    throw Object.assign(new Error('name must be a single path segment'), { code: 'EINVAL' })
  }
  const target = join(base, name)
  await mkdir(target)
  return target
}

/**
 * @returns {(request: Request) => Promise<Response>}
 */
function createBrowseHandler() {
  return async function browse(request) {
    try {
      if (request.method === 'GET') {
        const url = new URL(request.url)
        const requested = url.searchParams.get('path')
        const result = await list(requested === null || requested === '' ? undefined : requested, request.signal)
        return jsonResponse({ ok: true, ...result })
      }
      if (request.method === 'POST') {
        const body = await request.json().catch(() => null)
        if (body === null || typeof body !== 'object' || typeof body.path !== 'string' || typeof body.name !== 'string') {
          return jsonResponse({ ok: false, error: 'path and name required' }, 400)
        }
        const created = await createDirectory(body.path, body.name)
        return jsonResponse({ ok: true, path: created })
      }
      return textResponse(405, 'method not allowed')
    } catch (error) {
      const code = errorCodeOf(error)
      const message = error instanceof Error ? error.message : String(error)
      if (code === 'ENOENT') return jsonResponse({ ok: false, error: message }, 404)
      if (code === 'EEXIST') return jsonResponse({ ok: false, error: message }, 409)
      if (code === 'EACCES' || code === 'EPERM') return jsonResponse({ ok: false, error: message }, 403)
      if (code === 'EINVAL') return jsonResponse({ ok: false, error: message }, 400)
      debug('browse', message)
      return jsonResponse({ ok: false, error: message }, 500)
    }
  }
}

export { createBrowseHandler, fullyQualified, ancestryCrumbs, boundedInsert, list, createDirectory, MAX_ENTRIES }
