/**
 * The phone bottom bar: Chat / Sessions / Files / More.
 *
 * It is a pure view over {@link module:dsh-remote/client/mobile/chrome}: it reads
 * the active item from the shared observable and asks the layout service to
 * change the surface. It owns no observer of its own.
 *
 * @module dsh-remote/client/mobile/nav
 */
import { current, subscribe } from './chrome.js'
import { activePanelId, layoutOf, selectPanel, sidebarRightOf } from './service.js'
import { isMobileLayout } from './mode.js'
import { selectorFor } from './anchors.js'

/** Keep the composer from summoning the keyboard under a sheet. */
function suppressComposerFocus(ms = 700) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return
  const onFocus = (event) => {
    const target = event.target
    if (target && typeof target.closest === 'function' && target.closest(selectorFor('composerInput'))) {
      try {
        target.blur()
      } catch {
        // Already blurred.
      }
    }
  }
  document.addEventListener('focusin', onFocus, true)
  const active = /** @type {HTMLElement|null} */ (document.activeElement)
  if (active && typeof active.blur === 'function') {
    try {
      active.blur()
    } catch {
      // Already blurred.
    }
  }
  window.setTimeout(() => document.removeEventListener('focusin', onFocus, true), ms)
}

/** @returns {boolean} */
function drawerOpen() {
  try {
    const row = document.querySelector(selectorFor('shellRoot'))
    const container = row !== null && row.parentElement !== null ? row.parentElement : null
    return container === null ? false : !container.hasAttribute('data-sidebar-collapsed')
  } catch {
    return false
  }
}

/**
 * @param {any} ctx
 * @param {boolean} open
 */
function setDrawer(ctx, open) {
  const isOpen = drawerOpen()
  if (open === isOpen) return
  const layout = layoutOf(ctx)
  if (layout && typeof layout.toggleSidebar === 'function') layout.toggleSidebar()
}

/**
 * @param {any} ctx
 * @param {boolean} open
 */
function setRightPanel(ctx, open) {
  const right = sidebarRightOf(ctx)
  if (!right) return
  let isOpen = false
  try {
    isOpen = document.querySelector(selectorFor('rightPanelOpen')) !== null
  } catch {
    isOpen = false
  }
  if (open === isOpen) return
  if (typeof right.toggleExpanded === 'function') right.toggleExpanded()
}

/**
 * Open the Files sheet for the on-screen Session.
 *
 * The right Sidebar only has a Session while the Conversation is the main panel;
 * from a global panel we first return to the Conversation, then wait for the
 * service to be ready instead of polling on a fixed timer.
 *
 * @param {any} ctx
 * @param {number} [timeoutMs]
 * @returns {Promise<boolean>} whether the sheet was opened.
 */
function openFiles(ctx, timeoutMs = 1000) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return Promise.resolve(false)
  const root = document.documentElement
  suppressComposerFocus()
  if (activePanelId(ctx) !== null) {
    if (root && root.classList) root.classList.add('dshm-switching')
    selectPanel(ctx, null)
  }
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve) => {
    const attempt = () => {
      const right = sidebarRightOf(ctx)
      if (right && typeof right.openTab === 'function') {
        try {
          right.openTab('files')
          if (root && root.classList) window.setTimeout(() => root.classList.remove('dshm-switching'), 80)
          resolve(true)
          return
        } catch {
          // The Session is not mounted yet; retry below.
        }
      }
      if (Date.now() >= deadline) {
        if (root && root.classList) root.classList.remove('dshm-switching')
        resolve(false)
        return
      }
      window.setTimeout(attempt, 60)
    }
    attempt()
  })
}

/**
 * @param {{h: Function, React: any, t: (key: string) => string, ctx: any, panelId: string, glyphs: Record<string, Function>, onView: (view: string) => void}} deps
 */
function createMobileNav(deps) {
  const { h, React, t, ctx, panelId, glyphs, onView } = deps
  return function MobileBottomNav() {
    const [visible, setVisible] = React.useState(isMobileLayout())
    const [view, setView] = React.useState(current().view)

    React.useEffect(() => {
      const update = () => setVisible(isMobileLayout())
      update()
      if (typeof window === 'undefined') return undefined
      window.addEventListener('resize', update, { passive: true })
      window.addEventListener('orientationchange', update, { passive: true })
      let media
      if (typeof window.matchMedia === 'function') {
        try {
          media = window.matchMedia('(max-width: 900px)')
          if (media && typeof media.addEventListener === 'function') media.addEventListener('change', update)
          else if (media && typeof media.addListener === 'function') media.addListener(update)
        } catch {
          media = undefined
        }
      }
      return () => {
        window.removeEventListener('resize', update)
        window.removeEventListener('orientationchange', update)
        if (media) {
          if (typeof media.removeEventListener === 'function') media.removeEventListener('change', update)
          else if (media && typeof media.removeListener === 'function') media.removeListener(update)
        }
      }
    }, [])

    React.useEffect(() => subscribe((state) => setView(state.view)), [])

    if (!visible) return null

    const go = (next) => {
      if (next === 'chat') {
        setRightPanel(ctx, false)
        setDrawer(ctx, false)
        selectPanel(ctx, null)
        onView('chat')
      } else if (next === 'sessions') {
        setRightPanel(ctx, false)
        if (drawerOpen()) {
          setDrawer(ctx, false)
          onView('chat')
          return
        }
        if (activePanelId(ctx) !== null) {
          suppressComposerFocus()
          selectPanel(ctx, null)
          window.setTimeout(() => setDrawer(ctx, true), 30)
        } else {
          setDrawer(ctx, true)
        }
        onView('sessions')
      } else if (next === 'files') {
        setDrawer(ctx, false)
        void openFiles(ctx).then((opened) => {
          if (opened) onView('files')
          else onView('chat')
        })
        return
      } else if (next === 'more') {
        setRightPanel(ctx, false)
        setDrawer(ctx, false)
        selectPanel(ctx, panelId)
        onView('more')
      }
      setView(next)
    }

    const items = [
      { id: 'chat', label: t('mobileChat'), icon: glyphs.chat },
      { id: 'sessions', label: t('mobileSessions'), icon: glyphs.sessions },
      { id: 'files', label: t('mobileFiles'), icon: glyphs.files },
      { id: 'more', label: t('mobileMore'), icon: glyphs.more },
    ]

    return h('nav', { className: 'dshr-nav', role: 'navigation', 'aria-label': t('mobileNav') },
      items.map((item) => h('button', {
        key: item.id,
        type: 'button',
        className: 'dshr-navItem' + (view === item.id ? ' dshr-navActive' : ''),
        'aria-current': view === item.id ? 'page' : undefined,
        title: item.label,
        onClick: () => go(item.id),
      },
        h(item.icon, { size: 22 }),
        h('span', null, item.label)
      ))
    )
  }
}

export { createMobileNav, openFiles, setDrawer, setRightPanel, suppressComposerFocus, drawerOpen }
