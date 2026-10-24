/**
 * One observable for the shell's chrome state, one MutationObserver, one rAF.
 *
 * The previous implementation ran two `subtree: true` observers over the same
 * attribute pair, each doing its own `querySelector` work and writing classes on
 * every mutation, plus a 250 ms poll for the first ten seconds. Everything now
 * funnels through this module: a mutation schedules a frame, the frame reads the
 * DOM once, and listeners are told only when a value actually changed.
 *
 * @module dsh-remote/client/mobile/chrome
 */
import { selectorFor } from './anchors.js'

/**
 * @typedef {object} ChromeState
 * @property {boolean} drawerOpen
 * @property {boolean} rightOpen
 * @property {boolean} switching
 * @property {string} view - which bottom-bar item matches the surface.
 */

/** @type {ChromeState} */
const state = { drawerOpen: false, rightOpen: false, switching: false, view: 'chat' }

/** @type {Set<(state: ChromeState) => void>} */
const listeners = new Set()

/** @param {ChromeState} next */
function publish(next) {
  const changed = next.drawerOpen !== state.drawerOpen
    || next.rightOpen !== state.rightOpen
    || next.switching !== state.switching
    || next.view !== state.view
  state.drawerOpen = next.drawerOpen
  state.rightOpen = next.rightOpen
  state.switching = next.switching
  state.view = next.view
  if (!changed) return
  for (const listener of [...listeners]) {
    try {
      listener(state)
    } catch {
      // A disposed component must not break navigation.
    }
  }
}

/** @param {(state: ChromeState) => void} listener */
function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function current() {
  return state
}

/**
 * Read the frame's attributes and the panel selection, then publish.
 *
 * @param {Document} document
 * @param {{activePanelId?: string|null}|undefined} panel - the layout service snapshot, when available.
 * @param {string} panelId - this plugin's panel key.
 * @returns {ChromeState}
 */
function read(document, panel, panelId) {
  let drawerOpen = false
  try {
    const row = document.querySelector(selectorFor('shellRoot'))
    const frame = row !== null && row.parentElement !== null ? row.parentElement : null
    if (frame !== null) drawerOpen = !frame.hasAttribute('data-sidebar-collapsed')
  } catch {
    drawerOpen = false
  }
  let rightOpen = false
  try {
    rightOpen = document.querySelector(selectorFor('rightPanelOpen')) !== null
  } catch {
    rightOpen = false
  }
  const activePanelId = panel === undefined || panel === null ? null : panel.activePanelId
  let view = 'chat'
  if (rightOpen) view = 'files'
  else if (activePanelId !== null && activePanelId !== undefined) view = activePanelId === panelId ? 'more' : 'more'
  else if (drawerOpen) view = 'sessions'
  publish({ drawerOpen, rightOpen, switching: state.switching, view })
  return state
}

/**
 * Mirror the state onto `<html>` so the stylesheet can react without JS per node.
 *
 * `.dshm-frame` is the load-bearing one: `mobile.css` uses it to replace the
 * three-column grid with a single column plus the bottom row. Without it the
 * desktop grid stays in place and the conversation is squeezed into a strip a few
 * characters wide.
 *
 * @param {Document} document
 * @param {ChromeState} value
 */
function applyClasses(document, value) {
  const root = document.documentElement
  if (root === null || root.classList === undefined) return
  const set = (name, on) => {
    try {
      if (on) root.classList.add(name)
      else root.classList.remove(name)
    } catch {
      // A stub document in tests.
    }
  }
  set('dshm-sidebar-open', value.drawerOpen)
  set('dshm-right-open', value.rightOpen)
  set('dshm-switching', value.switching)
  applyFrameClass(document)
}

/**
 * Tag the shell's frame element so `mobile.css` can regrid it. Called on every
 * sync because the frame remounts when the layout service rebuilds the shell.
 * @param {Document} document
 */
function applyFrameClass(document) {
  try {
    const row = document.querySelector(selectorFor('shellRoot'))
    const frame = row !== null && row.parentElement !== null ? row.parentElement : null
    if (frame === null || frame.classList === undefined) return
    frame.classList.add('dshm-frame')
  } catch {
    // No shell yet, or a stub document in tests.
  }
}

/**
 * Put the drawer's scroll position back at the top when it opens, so the
 * workspace list starts at its first row instead of halfway down.
 *
 * Deferred to an idle slot: the drawer is still animating when the open state
 * lands, and reading layout mid-transition forces a synchronous reflow of the
 * whole sidebar.
 *
 * @param {Document} document
 * @param {Window} window
 */
function resetDrawerScroll(document, window) {
  const run = () => {
    try {
      const sidebar = document.querySelector(selectorFor('sidebarCol'))
      if (sidebar === null) return
      let touched = 0
      for (const element of sidebar.querySelectorAll('*')) {
        if (touched >= 20) break
        if (element.scrollTop > 0 && element.scrollHeight > element.clientHeight + 2) {
          element.scrollTop = 0
          touched += 1
        }
      }
    } catch {
      // A non-DOM document in tests.
    }
  }
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run)
  else window.setTimeout(run, 120)
}

/**
 * Start observing. Returns a disposer.
 *
 * @param {{
 *   document: Document,
 *   window: Window,
 *   readPanel: () => {activePanelId?: string|null}|undefined,
 *   panelId: string,
 *   onView: (view: string) => void,
 * }} options
 */
function installChrome(options) {
  const { document, window, readPanel, panelId, onView } = options
  let frame = 0
  let lastPublished = ''
  let drawerWasOpen = false

  const sync = () => {
    frame = 0
    // Nothing here may touch the shell until the mobile layer is actually on:
    // `.dshm-frame` regrids the page, and `dshm-sidebar-open` floats the drawer
    // over it. The original implementation guarded on this class for the same
    // reason, and dropping the guard is what made the page unusable.
    try {
      if (!document.documentElement.classList.contains('dshm-mobile')) return
    } catch {
      return
    }
    const value = read(document, readPanel(), panelId)
    applyClasses(document, value)
    const justOpened = value.drawerOpen && !drawerWasOpen
    drawerWasOpen = value.drawerOpen
    if (justOpened) resetDrawerScroll(document, window)
    const key = String(value.drawerOpen) + String(value.rightOpen) + value.view
    if (key === lastPublished) return
    lastPublished = key
    onView(value.view)
  }
  const schedule = () => {
    if (frame !== 0) return
    frame = typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame(sync)
      : window.setTimeout(sync, 16)
  }

  const observer = typeof MutationObserver === 'function'
    ? new MutationObserver(schedule)
    : undefined
  if (observer !== undefined) {
    try {
      observer.observe(document.documentElement, {
        attributes: true,
        subtree: true,
        attributeFilter: ['data-sidebar-collapsed', 'data-sidebar-right-open'],
      })
    } catch {
      // Nothing to observe in a stub document.
    }
  }

  // The panel selection is service state, not a DOM attribute; subscribe if the
  // layout service exposes it, otherwise the attribute observer still covers the
  // drawer and the sheet.
  if (typeof readPanel === 'function') schedule()

  return () => {
    if (observer !== undefined) observer.disconnect()
    if (frame !== 0) {
      if (typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(frame)
      else window.clearTimeout(frame)
    }
    listeners.clear()
    // Leave the shell exactly as it was: a stale `.dshm-frame` on an unloaded
    // plugin would keep the one-column grid after the layer is gone.
    try {
      const row = document.querySelector(selectorFor('shellRoot'))
      const element = row !== null && row.parentElement !== null ? row.parentElement : null
      if (element !== null && element.classList !== undefined) element.classList.remove('dshm-frame')
    } catch {
      // Already detached.
    }
  }
}

export { installChrome, subscribe, current, publish, read, applyClasses, applyFrameClass, resetDrawerScroll }
