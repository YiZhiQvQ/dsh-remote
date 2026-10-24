import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'

/**
 * The panel's listener-status row across the lifecycle.
 *
 * Pause/resume runs through the very listener it stops, so for a moment the
 * proxy is neither running nor broken. Rendering that moment in the red "no
 * listener" state is what made a pause look like a crash; these cases pin the
 * four states the row has to distinguish.
 */

/** @param {any} tree @returns {{className: string, text: string}[]} */
function statusRows(tree) {
  const rows = []
  const walk = (node) => {
    if (node === null || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const child of node) walk(child)
      return
    }
    const className = String((node.props && node.props.className) || '')
    if (className.includes('dshr-status')) {
      const text = []
      const collect = (child) => {
        if (typeof child === 'string') text.push(child)
        else if (Array.isArray(child)) child.forEach(collect)
        else if (child && typeof child === 'object') collect(child.children)
      }
      collect(node.children)
      rows.push({ className, text: text.join('') })
    }
    walk(node.children)
  }
  walk(tree)
  return rows
}

const BASE = {
  lanAddresses: [{ address: '10.40.16.57' }],
  listenPort: 3080,
  dshPort: 52551,
  auth: { username: 'admin', source: 'file' },
  warnings: [],
}

test('the status row distinguishes running, stopping, stopped and starting', () => {
  const states = {
    running: { portProxyReachable: true, paused: false, proxy: { phase: 'running', running: true } },
    stopping: { portProxyReachable: false, paused: true, proxy: { phase: 'stopping', running: false } },
    stopped: { portProxyReachable: false, paused: true, proxy: { phase: 'stopped', running: false } },
    starting: { portProxyReachable: false, paused: false, proxy: { phase: 'starting', running: false } },
  }
  const expected = {
    running: 'dshr-status dshr-ok',
    stopping: 'dshr-status dshr-wait',
    stopped: 'dshr-status dshr-bad',
    starting: 'dshr-status dshr-wait',
  }
  for (const [phase, extra] of Object.entries(states)) {
    // The panel reads its info from useState, so the stub has to hand back the
    // loaded snapshot: patch it per render.
    const { Panel } = loadBundleWith({ ...BASE, ...extra })
    const rows = statusRows(Panel({}))
    assert.equal(rows.length, 1, phase + ' renders exactly one status row')
    assert.equal(rows[0].className, expected[phase], phase + ' has its own tone')
  }
})

/** Load the bundle with the panel's first useState already resolved. */
function loadBundleWith(info) {
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState: (value) => (value && value.loading === true ? [{ loading: false, error: '', info }, () => {}] : [value, () => {}]),
    useEffect: () => {},
    useCallback: (fn) => fn,
    useRef: (value) => ({ current: value }),
  }
  const document = {
    documentElement: {
      classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
      style: { setProperty() {}, removeProperty() {} },
      setAttribute() {}, removeAttribute() {}, hasAttribute: () => false,
    },
    head: { appendChild() {} },
    body: { appendChild() {} },
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement() {
      return { attrs: {}, style: {}, classList: { add() {}, remove() {} }, setAttribute() {}, remove() {}, textContent: '' }
    },
    addEventListener() {},
    removeEventListener() {},
  }
  const window = {
    location: { hostname: '10.40.16.57', port: '3080', protocol: 'http:', search: '' },
    addEventListener() {}, removeEventListener() {},
    setTimeout: () => 0, clearTimeout() {},
    requestAnimationFrame: (fn) => { fn(); return 1 },
    cancelAnimationFrame() {},
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    __ModuleLoader__: { load(options) { window.__captured = options } },
  }
  const sandbox = {
    window, document, console,
    navigator: { userAgent: '' },
    MutationObserver: class { observe() {} disconnect() {} },
  }
  sandbox.globalThis = sandbox
  runInContext(readFileSync(new URL('../client.js', import.meta.url), 'utf8'), createContext(sandbox), { filename: 'client.js' })
  const plugin = window.__captured.factory((name) => (name === 'react' ? React : {}))
  const registrations = new Map()
  const ctx = {
    locale: { bind: () => (key) => key, register: () => () => {} },
    effect(fn) { fn(); return () => {} },
    get: () => undefined,
    slots: { inject(_name, cb) { cb() }, register(spec, component) { registrations.set(spec.name, component); return () => {} } },
  }
  plugin.apply(ctx)
  return { Panel: registrations.get('main') }
}
