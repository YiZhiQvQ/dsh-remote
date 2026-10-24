/**
 * Remote pages have no DeepSeek account sign-in or sign-out.
 *
 * Both flows are host-local: sign-in needs an OAuth callback on a loopback
 * origin (a LAN page can never supply one, so the attempt dies with a protocol
 * error), and sign-out clears the grant for the desktop window too. Offering
 * either control on a phone produces a button that can only fail or that quietly
 * breaks the computer, so this module retires them and swallows a click that
 * still reaches one.
 *
 * DSH owns that markup and exposes no id or data attribute on it, so the label
 * is the only handle: a menu row, the signed-out account card's button, and the
 * sign-in dialog's primary button all read exactly "登录"/"退出登录" (or their
 * English equivalents). Matching the whole label — not a substring — keeps the
 * neighbouring entries (设置, 意见反馈, 添加 API Key) and copy such as
 * "登录失败" untouched.
 *
 * Two details make the hiding stick, and both were wrong in the first attempt:
 *
 * - The observer comes from the page's own `window`, not from the ambient
 *   global. Client bundles are evaluated by the module loader inside its own
 *   scope, so a bare `MutationObserver` is not guaranteed to resolve — and when
 *   it does not, the guard silently degrades to a one-time scan and every
 *   later-mounted menu stays visible.
 * - The hide is an inline `display:none!important` as well as a class. React
 *   rewrites `className` from its props whenever that prop changes, which
 *   drops a class added from outside; a `style` key React never manages
 *   survives.
 *
 * @module dsh-remote/client/account/guard
 */
import { showUploadToast } from '../upload/toast.js'

/** Sign-in labels, as shipped in the account dictionaries. */
const SIGN_IN = /^(?:登录|登入|重新登录|sign in|sign in again|log in)$/i
/** Sign-out labels, as shipped in the account dictionaries. */
const SIGN_OUT = /^(?:退出登录|登出|sign out|log out)$/i

/** Attribute kept for debuggability and as the stylesheet's second handle. */
const HIDDEN_ATTRIBUTE = 'data-dshr-acct-hidden'

/**
 * Normalized visible label of a control.
 * @param {Element} element
 * @returns {string}
 */
function labelOf(element) {
  return String(element.textContent || '').replace(/\s+/g, ' ').trim()
}

/**
 * Whether an element is an account sign-in or sign-out control.
 * @param {Element|null} element
 * @returns {boolean}
 */
function isAccountAction(element) {
  if (element === null || typeof element.getAttribute !== 'function') return false
  // Account controls are all real buttons; a stub without a tagName still gets
  // through so the module can be tested without a DOM.
  const tag = typeof element.tagName === 'string' ? element.tagName.toUpperCase() : ''
  if (tag !== '' && tag !== 'BUTTON') return false
  const label = labelOf(element)
  return SIGN_IN.test(label) || SIGN_OUT.test(label)
}

/**
 * Hide one account control. Idempotent: the observer may visit the same node
 * many times while a menu stays open.
 *
 * @param {Element} node
 * @param {string} marker
 * @returns {boolean} whether the node is an account control
 */
function hideControl(node, marker) {
  if (!isAccountAction(node)) return false
  // Writing an attribute is itself a DOM mutation. This function runs inside a
  // MutationObserver callback, so an unguarded write would re-enter the observer
  // forever. The marker attribute is the idempotence latch.
  if (typeof node.hasAttribute === 'function' && node.hasAttribute(HIDDEN_ATTRIBUTE)) return true
  const style = /** @type {HTMLElement} */ (node).style
  if (style && typeof style.setProperty === 'function') {
    style.setProperty('display', 'none', 'important')
  } else if (style) {
    style.display = 'none'
  }
  if (typeof node.classList?.add === 'function') node.classList.add(marker)
  if (typeof node.setAttribute === 'function') node.setAttribute(HIDDEN_ATTRIBUTE, '')
  return true
}

/**
 * Hide every account control inside one subtree.
 * @param {Element} root
 * @param {string} marker
 * @returns {number} how many were hidden
 */
function hideSubtree(root, marker) {
  let count = 0
  try {
    if (typeof root.matches === 'function' && root.matches('button')) {
      if (hideControl(root, marker)) count += 1
    }
    for (const node of root.querySelectorAll('button')) {
      if (hideControl(node, marker)) count += 1
    }
  } catch {
    // A stub element in tests.
  }
  return count
}

/**
 * @param {{
 *   document: Document,
 *   window: Window,
 *   t: (key: string) => string,
 *   marker?: string,
 * }} options
 * @returns {() => void} disposer
 */
function installAccountGuard(options) {
  const { document, window, t } = options
  const marker = options.marker || 'dshr-acct-off'
  if (typeof document.addEventListener !== 'function') return () => {}
  let disposed = false
  let hidden = 0

  const explain = () => {
    const toast = showUploadToast(document, t('accountRemoteOnly'))
    window.setTimeout(() => toast.remove(), 3200)
  }

  /** Hide every account control in the document; returns how many. */
  const scan = () => {
    let nodes
    try {
      nodes = document.querySelectorAll('button')
    } catch {
      return hidden
    }
    let count = 0
    for (const node of nodes) if (hideControl(node, marker)) count += 1
    hidden = count
    return count
  }

  // Coalesce the extra scans a click can trigger into one per frame.
  let frame = 0
  const scheduleScan = () => {
    if (frame !== 0 || disposed) return
    const run = () => {
      frame = 0
      scan()
    }
    frame = typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame(run)
      : window.setTimeout(run, 16)
  }

  /** Swallow the click before React's delegated handler sees it. */
  const onClick = (event) => {
    const target = event && event.target
    if (!target || typeof target.closest !== 'function') return
    const control = target.closest('button')
    if (control !== null && isAccountAction(control)) {
      event.preventDefault()
      event.stopImmediatePropagation()
      hideControl(control, marker)
      explain()
      return
    }
    // Opening the account menu is a click on its trigger; the menu is a portal
    // that mounts on the same tick, so sweep once after it lands. This also
    // covers a runtime where the observer below is unavailable.
    scheduleScan()
  }

  // The observer must come from the page's own window: a client bundle is
  // evaluated in the loader's scope, where the ambient global is not reliable.
  const fromWindow = /** @type {{MutationObserver?: typeof MutationObserver}} */ (window).MutationObserver
  const Observer = fromWindow
    || (typeof MutationObserver === 'function' ? MutationObserver : undefined)
  const observer = typeof Observer === 'function'
    ? new Observer((records) => {
        if (disposed) return
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (node !== null && node.nodeType === 1) hideSubtree(/** @type {Element} */ (node), marker)
          }
        }
      })
    : undefined

  document.addEventListener('click', onClick, true)
  if (observer !== undefined) {
    try {
      // childList only. Observing attributes would re-enter this callback on
      // the very writes it performs; the inline style it sets is not something
      // React rewrites, so a class rewrite alone cannot un-hide a control.
      observer.observe(document.body || document.documentElement, { childList: true, subtree: true })
    } catch {
      // A stub document in tests.
    }
  }
  scan()

  // A tiny inspection seam for the phone's devtools:
  // `__dshRemoteAccountGuard.scan()` re-applies the hide and reports the count.
  try {
    globalThis.__dshRemoteAccountGuard = {
      scan,
      hidden: () => hidden,
      marker,
      observer: observer !== undefined,
    }
  } catch {
    // A frozen global is harmless.
  }

  return () => {
    disposed = true
    document.removeEventListener('click', onClick, true)
    if (observer !== undefined) observer.disconnect()
    if (frame !== 0) {
      if (typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(frame)
      else window.clearTimeout(frame)
    }
  }
}

export { installAccountGuard, isAccountAction, hideControl, SIGN_IN, SIGN_OUT, HIDDEN_ATTRIBUTE }
