/**
 * Drag-and-drop upload onto a Files directory row.
 *
 * `dragover` fires around sixty times a second; the hit test walks ancestors and
 * reads layout, so it is coalesced onto animation frames and skipped entirely
 * while the pointer has not moved far enough to change the answer.
 *
 * @module dsh-remote/client/upload/drop
 */
import { selectorFor } from '../mobile/anchors.js'
import { showUploadToast } from './toast.js'

const WINDOWS_ABSOLUTE = /^(?:[A-Za-z]:[\\/]|[\\/]{2})/
const POINTER_EPSILON = 8

/** @param {unknown} value */
function isAbsoluteClientPath(value) {
  return typeof value === 'string' && WINDOWS_ABSOLUTE.test(value)
}

/**
 * The directory row under the pointer, if any.
 * @param {Document} document
 * @param {number} x
 * @param {number} y
 * @returns {{path: string, header: Element}|undefined}
 */
function filesDropTargetAt(document, x, y) {
  let element
  try {
    element = typeof document.elementFromPoint === 'function' ? document.elementFromPoint(x, y) : null
  } catch {
    element = null
  }
  if (!element) return undefined
  const row = typeof element.closest === 'function' ? element.closest(selectorFor('filesPath')) : null
  if (row !== null) {
    const value = row.getAttribute('data-files-path')
    if (isAbsoluteClientPath(value)) return { path: value, header: row }
  }
  let container = element
  for (let depth = 0; container && depth < 10; depth += 1, container = container.parentElement) {
    const header = container.querySelector('[data-files-path="true"]')
    const rows = container.querySelectorAll('[data-files-path]:not([data-files-path="true"])')
    if (header !== null && rows.length > 0) {
      const value = String(header.textContent || '').trim()
      if (isAbsoluteClientPath(value)) return { path: value, header }
    }
  }
  return undefined
}

/** @param {Element} header */
function refreshFilesPanel(header) {
  try {
    let container = header
    for (let depth = 0; container && depth < 6; depth += 1, container = container.parentElement) {
      const buttons = [...container.querySelectorAll('button')]
      const button = buttons.find((candidate) => /refresh|刷新/i.test(String(candidate.getAttribute('aria-label') || candidate.getAttribute('title') || '')))
      if (button !== undefined) {
        button.click()
        return
      }
    }
  } catch {
    // The change feed will refresh the listing anyway.
  }
}

/**
 * Upload every file to one directory, reporting progress as it goes.
 * @param {{path: string, header: Element}} target
 * @param {File[]} files
 * @param {(key: string) => string} t
 * @param {Document} document
 */
async function uploadFilesInto(target, files, t, document) {
  if (typeof fetch !== 'function' || !target || files.length === 0) return
  const toast = showUploadToast(document, t('uploading') + ' ' + String(files.length) + ' ' + t('fileCount') + '…')
  let uploaded = 0
  try {
    for (const file of files) {
      const name = String(file && file.name ? file.name : 'upload.bin')
      const url = '/api/remote/upload?path=' + encodeURIComponent(target.path) + '&name=' + encodeURIComponent(name)
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/octet-stream' },
        body: file,
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data.ok === false) throw new Error(data.error || ('HTTP ' + String(response.status)))
      uploaded += 1
      toast.set(t('uploaded') + ' ' + String(uploaded) + '/' + String(files.length) + ' ' + t('fileCount'))
    }
    toast.set(t('uploaded') + ' ' + String(uploaded) + ' ' + t('fileCount') + ' ' + t('uploadTo') + ' ' + target.path)
    refreshFilesPanel(target.header)
    if (typeof window !== 'undefined') window.setTimeout(() => toast.remove(), 2600)
  } catch (error) {
    toast.error()
    toast.set(t('uploadFailed') + ': ' + String(error && error.message ? error.message : error))
    if (typeof window !== 'undefined') window.setTimeout(() => toast.remove(), 5000)
  }
}

/**
 * Install the window-level drag handlers.
 * @param {{document: Document, window: Window, t: (key: string) => string}} deps
 * @returns {() => void}
 */
function installFilesDropUpload(deps) {
  const { document, window, t } = deps
  const target = typeof window.addEventListener === 'function' ? window : undefined
  if (target === undefined) return () => {}
  let active = false
  let frame = 0
  /** @type {{x: number, y: number, drop: {path: string, header: Element}|undefined}} */
  const pending = { x: 0, y: 0, drop: undefined }

  const setActive = (value) => {
    if (active === value) return
    active = value
    try {
      const root = document.documentElement
      if (root && root.classList && typeof root.classList.toggle === 'function') root.classList.toggle('dshr-file-drop', value)
    } catch {
      // A stub document in tests.
    }
  }

  const resolve = () => {
    frame = 0
    pending.drop = filesDropTargetAt(document, pending.x, pending.y)
    setActive(pending.drop !== undefined)
  }

  const onDragOver = (event) => {
    const data = event.dataTransfer
    if (!data || !Array.from(data.types || []).includes('Files')) return
    const dx = Math.abs(event.clientX - pending.x)
    const dy = Math.abs(event.clientY - pending.y)
    pending.x = event.clientX
    pending.y = event.clientY
    if (frame === 0 && (dx > POINTER_EPSILON || dy > POINTER_EPSILON || pending.drop === undefined)) {
      frame = typeof window.requestAnimationFrame === 'function'
        ? window.requestAnimationFrame(resolve)
        : window.setTimeout(resolve, 16)
    }
    if (pending.drop === undefined) return
    event.preventDefault()
    event.stopPropagation()
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation()
    data.dropEffect = 'copy'
  }

  const onDragLeave = (event) => {
    if (event.relatedTarget === null) setActive(false)
  }

  const onDrop = (event) => {
    const data = event.dataTransfer
    if (!data || !data.files || data.files.length === 0) return
    const drop = filesDropTargetAt(document, event.clientX, event.clientY)
    if (drop === undefined) {
      setActive(false)
      return
    }
    event.preventDefault()
    event.stopPropagation()
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation()
    setActive(false)
    void uploadFilesInto(drop, [...data.files], t, document)
  }

  target.addEventListener('dragover', onDragOver, true)
  target.addEventListener('dragleave', onDragLeave, true)
  target.addEventListener('drop', onDrop, true)
  return () => {
    target.removeEventListener('dragover', onDragOver, true)
    target.removeEventListener('dragleave', onDragLeave, true)
    target.removeEventListener('drop', onDrop, true)
    if (frame !== 0 && typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(frame)
    setActive(false)
  }
}

export { installFilesDropUpload, filesDropTargetAt, uploadFilesInto, isAbsoluteClientPath, refreshFilesPanel }
