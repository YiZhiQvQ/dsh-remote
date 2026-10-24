/**
 * Phone gestures CSS cannot express: tapping the dimmed area closes the drawer,
 * picking a session closes it, Escape backs out.
 *
 * @module dsh-remote/client/mobile/interactions
 */
import { selectorFor } from './anchors.js'
import { setDrawer, setRightPanel } from './nav.js'
import { activePanelId, selectPanel } from './service.js'

/** @param {Document} document @returns {boolean} */
function mobileActive(document) {
  try {
    const root = document.documentElement
    return root !== null && root.classList !== undefined && root.classList.contains('dshm-mobile')
  } catch {
    return false
  }
}

/**
 * @param {{document: Document, window: Window, ctx: any}} deps
 * @returns {() => void}
 */
function installMobileInteractions(deps) {
  const { document, window, ctx } = deps
  if (typeof document.addEventListener !== 'function') return () => {}

  /** Close the drawer only after a real tap on a session row; a scroll is not a tap. */
  const retireDrawer = () => {
    window.setTimeout(() => {
      setDrawer(ctx, false)
      if (activePanelId(ctx) !== null) selectPanel(ctx, null)
    }, 180)
  }

  const onPointerDown = (event) => {
    if (!mobileActive(document)) return
    const target = event && event.target
    if (!target) return
    const root = document.documentElement
    let sidebar = null
    try {
      sidebar = document.querySelector(selectorFor('sidebarCol'))
    } catch {
      sidebar = null
    }
    if (sidebar !== null && typeof sidebar.contains === 'function' && sidebar.contains(target)) return
    if (!root.classList.contains('dshm-sidebar-open')) return
    if (typeof target.closest === 'function') {
      if (target.closest(selectorFor('conversationHeaderLeading')) !== null) return
      if (target.closest('.dshr-nav') !== null) return
    }
    setDrawer(ctx, false)
  }

  const onClick = (event) => {
    if (!mobileActive(document)) return
    const target = event && event.target
    if (!target || typeof target.closest !== 'function') return
    if (target.closest(selectorFor('rightToggle')) !== null) {
      // Opening Files from the header means leaving whatever global panel is up.
      window.setTimeout(() => {
        const panel = document.querySelector(selectorFor('rightPanelOpen'))
        if (panel === null) return
        if (document.querySelector(selectorFor('documentTab')) !== null) return
      }, 120)
    }
    if (target.closest(selectorFor('newSession')) !== null) {
      retireDrawer()
      return
    }
    const row = target.closest(selectorFor('sessionRow'))
    if (row === null) return
    const key = String(row.getAttribute('data-row-key') || '')
    if (!key.startsWith('session:')) return
    // Row actions ("…", archive, pin) must open their menu without retiring the
    // drawer. Workspace folders also carry data-row-key.
    const action = target.closest('[class*="_rowActions"], button')
    if (action !== null && row.contains(action)) return
    retireDrawer()
  }

  const onKeyDown = (event) => {
    if (!mobileActive(document) || !event || event.key !== 'Escape') return
    const root = document.documentElement
    if (root.classList.contains('dshm-right-open')) setRightPanel(ctx, false)
    else if (root.classList.contains('dshm-sidebar-open')) setDrawer(ctx, false)
  }

  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('click', onClick, true)
  document.addEventListener('keydown', onKeyDown)
  return () => {
    document.removeEventListener('pointerdown', onPointerDown, true)
    document.removeEventListener('click', onClick, true)
    document.removeEventListener('keydown', onKeyDown)
  }
}

export { installMobileInteractions, mobileActive }
