import test from 'node:test'
import assert from 'node:assert/strict'
import { installAccountGuard, isAccountAction, SIGN_IN, SIGN_OUT, HIDDEN_ATTRIBUTE } from '../src/client/account/guard.js'

/**
 * The account controls are DSH's, not this plugin's: they carry no id and no
 * data attribute, so the label is the only handle. These tests pin that contract
 * and the mechanisms built on it — the inline hide, the observer that catches
 * late-mounted menus, and the capture-phase click that stops the action.
 *
 * Two regressions are pinned here explicitly, because both were shipped and both
 * made the guard look like it did nothing:
 *   - a class-only hide, which React's next render erased;
 *   - an observer that also watched attributes, which re-entered itself on the
 *     very attribute it wrote.
 */

/** @param {string} text @param {{tag?: string, role?: string}} [options] */
function button(text, options = {}) {
  const attributes = new Map()
  if (options.role) attributes.set('role', options.role)
  const style = {
    values: new Map(),
    setProperty(name, value, priority) { this.values.set(name, { value, priority }) },
  }
  const classes = new Set()
  return {
    nodeType: 1,
    tagName: options.tag || 'BUTTON',
    textContent: text,
    style,
    classes,
    classList: { add(name) { classes.add(name) } },
    getAttribute(name) { return attributes.get(name) ?? null },
    setAttribute(name) { attributes.set(name, '') },
    hasAttribute(name) { return attributes.has(name) },
    querySelector() { return null },
  }
}

/** @param {Array<object>} nodes */
function makeDocument(nodes) {
  const listeners = []
  return {
    nodes,
    listeners,
    body: { appendChild() {} },
    documentElement: {},
    querySelectorAll(selector) { return selector === 'button' ? nodes : [] },
    createElement() {
      return { attrs: {}, style: {}, classList: { add() {}, remove() {} }, setAttribute() {}, remove() {}, textContent: '' }
    },
    addEventListener(kind, handler) { if (kind === 'click') listeners.push(handler) },
    removeEventListener() {},
  }
}

/** A window whose observer is captured rather than started. */
function makeWindow() {
  const captured = { callback: undefined, observed: undefined, disconnected: false }
  class Observer {
    constructor(callback) { captured.callback = callback }
    observe(_target, options) { captured.observed = options }
    disconnect() { captured.disconnected = true }
  }
  return {
    captured,
    MutationObserver: Observer,
    setTimeout(fn) { fn(); return 0 },
    clearTimeout() {},
    requestAnimationFrame(fn) { fn(); return 1 },
    cancelAnimationFrame() {},
  }
}

/** @param {object} document @param {object} window */
function install(document, window) {
  return installAccountGuard({ document, window, t: (key) => key })
}

test('the account actions are recognised by their shipped labels', () => {
  for (const label of ['登录', '登入', '重新登录', 'Sign in', 'Sign in again', 'Log in']) {
    assert.equal(isAccountAction(button(label)), true, label + ' is a sign-in control')
    assert.match(label, SIGN_IN)
  }
  for (const label of ['退出登录', '登出', 'Sign out', 'Log out']) {
    assert.equal(isAccountAction(button(label)), true, label + ' is a sign-out control')
    assert.match(label, SIGN_OUT)
  }
  // Neighbours must survive: other menu entries, the API-key escape hatch, and
  // copy that merely contains one of the words.
  assert.equal(isAccountAction(button('设置')), false)
  assert.equal(isAccountAction(button('意见反馈')), false)
  assert.equal(isAccountAction(button('添加 API Key')), false)
  assert.equal(isAccountAction(button('登录失败')), false)
  assert.equal(isAccountAction(button('退出登录说明')), false)
  // Only buttons are candidates, whatever their text.
  assert.equal(isAccountAction(button('登录', { tag: 'SPAN' })), false)
})

test('the guard hides with an inline !important style, not only a class', () => {
  // The regression: React recomposes `className` from its props on every render
  // and drops a class added from outside. The style property is what survives.
  const document = makeDocument([
    button('设置'),
    button('登录', { role: 'menuitem' }),
    button('退出登录', { role: 'menuitem' }),
    button('意见反馈'),
  ])
  const dispose = install(document, makeWindow())

  const login = document.nodes[1]
  const signOut = document.nodes[2]
  assert.deepEqual(login.style.values.get('display'), { value: 'none', priority: 'important' })
  assert.deepEqual(signOut.style.values.get('display'), { value: 'none', priority: 'important' })
  assert.ok(login.hasAttribute(HIDDEN_ATTRIBUTE), 'the marker attribute is set too')
  assert.equal(document.nodes[0].style.values.has('display'), false, 'the settings row stays')
  assert.equal(document.nodes[3].style.values.has('display'), false, 'the feedback row stays')
  dispose()
})

test('the hide survives a re-render that rewrites the className', () => {
  const document = makeDocument([button('登录', { role: 'menuitem' })])
  const dispose = install(document, makeWindow())
  const login = document.nodes[0]
  assert.deepEqual(login.style.values.get('display'), { value: 'none', priority: 'important' })

  // React rewrites the class list; the inline declaration is untouched because
  // it was never a prop.
  login.classes.clear()
  assert.deepEqual(login.style.values.get('display'), { value: 'none', priority: 'important' })
  dispose()
})

test('the observer watches childList only, so it cannot re-enter itself', () => {
  // The second regression: writing an attribute inside the callback re-fired the
  // observer forever, freezing the page.
  const document = makeDocument([])
  const window = makeWindow()
  const dispose = install(document, window)
  assert.deepEqual(window.captured.observed, { childList: true, subtree: true })
  assert.equal('attributes' in window.captured.observed, false, 'attribute observation would loop on the marker write')
  dispose()
  assert.equal(window.captured.disconnected, true)
})

test('a menu that mounts after the guard is hidden without a page sweep', () => {
  const document = makeDocument([])
  const window = makeWindow()
  const dispose = install(document, window)

  const signIn = button('登录')
  const settings = button('设置')
  const menu = {
    nodeType: 1,
    tagName: 'DIV',
    matches: () => false,
    querySelectorAll: (selector) => (selector === 'button' ? [signIn, settings] : []),
  }
  window.captured.callback([{ addedNodes: [menu] }])

  assert.deepEqual(signIn.style.values.get('display'), { value: 'none', priority: 'important' })
  assert.equal(settings.style.values.has('display'), false)
  dispose()
})

test('a click that reaches an account control is cancelled and explained', () => {
  const document = makeDocument([button('登录'), button('退出登录'), button('设置')])
  const dispose = install(document, makeWindow())
  assert.equal(document.listeners.length, 1, 'one capture-phase click listener')

  let prevented = 0
  let stopped = 0
  const click = (node) => ({
    target: { closest: () => node },
    preventDefault() { prevented += 1 },
    stopImmediatePropagation() { stopped += 1 },
  })

  document.listeners[0](click(document.nodes[0]))
  document.listeners[0](click(document.nodes[1]))
  assert.equal(prevented, 2, 'both account actions are refused')
  assert.equal(stopped, 2, 'the click never reaches the menu handler')

  document.listeners[0](click(document.nodes[2]))
  assert.equal(prevented, 2, 'the settings entry still works')
  dispose()
})

test('the guard is inert on a document without the event API', () => {
  const dispose = installAccountGuard({ document: {}, window: makeWindow(), t: (key) => key })
  assert.equal(typeof dispose, 'function')
  dispose()
})
