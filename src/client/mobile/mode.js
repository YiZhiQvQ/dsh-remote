/**
 * Which layout the page should use.
 *
 * The Electron desktop window can load the LAN URL too. It must never receive the
 * mobile layer: only a real browser on the LAN does.
 *
 * @module dsh-remote/client/mobile/mode
 */

const MOBILE_BREAKPOINT = 900
const TABLET_BREAKPOINT = 1180

/** @returns {boolean} */
function isDesktopShell() {
  try {
    // Electron injects this host-path bridge. A real remote browser never has it,
    // so it is the strongest local-desktop marker.
    if (globalThis.__DSH_HOST_PATHS__ !== undefined && globalThis.__DSH_HOST_PATHS__ !== null) return true
    const ua = typeof navigator !== 'undefined' ? String(navigator.userAgent || '') : ''
    if (/Electron/i.test(ua)) return true
    const proc = typeof process !== 'undefined' ? process : undefined
    if (proc && proc.versions && proc.versions.electron) return true
    if (globalThis.__DSH_ELECTRON__ === true || globalThis.__DSH_DESKTOP__ === true) return true
  } catch {
    // A browser without these markers is remote.
  }
  return false
}

/** @returns {boolean} */
function isRemoteOrigin() {
  if (isDesktopShell()) return false
  try {
    const host = String(window.location.hostname || '')
    return host !== '127.0.0.1' && host !== 'localhost' && host !== '::1' && host !== '[::1]' && host.length > 0
  } catch {
    return false
  }
}

/** `?dshm=mobile` / `?dshm=desktop` force a mode while developing the stylesheet. */
function forcedMobileMode() {
  try {
    const value = new URLSearchParams(window.location.search).get('dshm')
    if (value === 'mobile') return true
    if (value === 'desktop') return false
  } catch {
    // No URLSearchParams (or no window): fall back to measurement.
  }
  return undefined
}

/** @returns {boolean} */
function isMobileLayout() {
  if (isDesktopShell()) return false
  const forced = forcedMobileMode()
  if (forced !== undefined) return forced
  if (!isRemoteOrigin()) return false
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    const coarse = window.matchMedia('(pointer: coarse)').matches
    const narrow = window.matchMedia('(max-width: ' + String(MOBILE_BREAKPOINT) + 'px)').matches
    const tablet = window.matchMedia('(max-width: ' + String(TABLET_BREAKPOINT) + 'px)').matches
    if (coarse && tablet) return true
    return narrow
  } catch {
    return false
  }
}

/**
 * Keep the viewport meta in sync so the CSS environment variables resolve.
 *
 * viewport-fit=cover is what lets iOS draw under the notch, but on Android it
 * also removes the browser's own status-bar inset while env(safe-area-inset-top)
 * stays 0, so the page starts underneath the status bar. Only iOS gets cover;
 * Android keeps the default safe-area viewport, and the native shell adds its
 * own window insets.
 *
 * @param {Document} document
 */
function applyMobileViewport(document) {
  try {
    const meta = document.querySelector('meta[name="viewport"]')
    if (meta === null) return
    const view = document.defaultView
    const navigator = view && view.navigator ? view.navigator : undefined
    const userAgent = navigator && typeof navigator.userAgent === 'string' ? navigator.userAgent : ''
    const platform = navigator && typeof navigator.platform === 'string' ? navigator.platform : ''
    const touchPoints = navigator && typeof navigator.maxTouchPoints === 'number' ? navigator.maxTouchPoints : 0
    const ios = /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && touchPoints > 1)
    const cover = ios ? ',viewport-fit=cover' : ''
    meta.setAttribute('content', 'width=device-width,initial-scale=1' + cover + ',interactive-widget=resizes-content')
  } catch {
    // The head may not be ready yet; the next resize reapplies it.
  }
}

/**
 * Track the visual viewport so the bottom bar yields to the keyboard.
 * @param {HTMLElement} root
 * @param {Window} window
 * @returns {() => void}
 */
function installViewport(root, window) {
  let frame = 0
  const sync = () => {
    frame = 0
    try {
      const viewport = window.visualViewport
      if (!viewport) return
      if (!root.classList.contains('dshm-mobile')) {
        root.classList.remove('dshm-keyboard')
        root.style.removeProperty('--dshm-vv-height')
        return
      }
      // On iOS the layout viewport keeps its height while the keyboard covers it;
      // on Android interactive-widget already shrinks it.
      const keyboard = viewport.height < window.innerHeight - 80
      root.classList.toggle('dshm-keyboard', keyboard)
      if (keyboard) root.style.setProperty('--dshm-vv-height', Math.round(viewport.height) + 'px')
      else root.style.removeProperty('--dshm-vv-height')
    } catch {
      // visualViewport is optional.
    }
  }
  const schedule = () => {
    if (frame !== 0) return
    frame = typeof window.requestAnimationFrame === 'function' ? window.requestAnimationFrame(sync) : window.setTimeout(sync, 16)
  }
  if (window.visualViewport && typeof window.visualViewport.addEventListener === 'function') {
    window.visualViewport.addEventListener('resize', schedule)
    window.visualViewport.addEventListener('scroll', schedule)
  }
  sync()
  return () => {
    if (window.visualViewport && typeof window.visualViewport.removeEventListener === 'function') {
      window.visualViewport.removeEventListener('resize', schedule)
      window.visualViewport.removeEventListener('scroll', schedule)
    }
    if (frame !== 0) {
      if (typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(frame)
      else window.clearTimeout(frame)
    }
  }
}

export {
  MOBILE_BREAKPOINT,
  TABLET_BREAKPOINT,
  isDesktopShell,
  isRemoteOrigin,
  forcedMobileMode,
  isMobileLayout,
  applyMobileViewport,
  installViewport,
}
