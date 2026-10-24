import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'

/**
 * Loads the built `client.js` the way the DSH module system does: the bundle
 * registers a factory on `window.__ModuleLoader__`, and the shell later calls it
 * with a `require` that resolves the platform baseline (React here).
 *
 * This is the only test that exercises the artefact rather than the sources, so a
 * broken build (missing import, wrong wrapper, dropped registration) fails here.
 */

const React = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: (value) => [value, () => {}],
  useEffect: () => {},
  useCallback: (fn) => fn,
  useRef: (value) => ({ current: value }),
}

/** A DOM stub just complete enough for `apply` to run to completion. */
function installDom(hostname) {
  const classes = new Set()
  const nodes = []
  globalThis.window = {
    location: { hostname, port: '3080', protocol: 'http:', search: '' },
    addEventListener() {},
    removeEventListener() {},
    setTimeout: () => 0,
    clearTimeout() {},
    requestAnimationFrame: (fn) => {
      fn()
      return 1
    },
    cancelAnimationFrame() {},
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    setInterval: () => 0,
    clearInterval() {},
    __ModuleLoader__: { load(options) { globalThis.window.__captured = options } },
  }
  globalThis.document = {
    documentElement: {
      classList: {
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
        contains: (name) => classes.has(name),
        toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)),
      },
      style: { setProperty() {}, removeProperty() {} },
      setAttribute() {},
      removeAttribute() {},
      hasAttribute: () => false,
    },
    head: { appendChild() {} },
    body: { appendChild() {}, removeChild() {} },
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement(_tag) {
      const element = { attrs: {}, style: {}, classList: { add() {}, remove() {} }, setAttribute(n, v) { this.attrs[n] = v }, remove() {}, textContent: '' }
      nodes.push(element)
      return element
    },
    addEventListener() {},
    removeEventListener() {},
    activeElement: null,
  }
  return { classes, nodes }
}

function makeContext() {
  const registrations = new Map()
  const effects = []
  const ctx = {
    locale: { bind: () => (key) => key, register: () => () => {} },
    effect(fn) {
      const dispose = fn()
      if (typeof dispose === 'function') effects.push(dispose)
      return () => {}
    },
    get: () => undefined,
    slots: {
      inject(_name, callback) { callback() },
      register(spec, component) {
        registrations.set(spec.name + '#' + (spec.id ?? spec.key), { spec, component })
        return () => {}
      },
    },
  }
  return { ctx, registrations, effects }
}

/**
 * Execute the bundle in a fresh VM context.
 *
 * The artefact is a classic script that reads `window` and registers a factory;
 * it is not a module, so it cannot be `require`d or `import`ed. Evaluating it
 * per test also guarantees a clean module-level state, which the plugin relies on
 * for its "is this the desktop shell?" probe.
 */
function loadBundle(globals = {}) {
  const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
  // The bundle reads and deletes `globalThis.__DSH_HOST_PATHS__`, so that marker
  // has to live inside the VM context, not on the test's own globalThis.
  const sandbox = { window: globalThis.window, document: globalThis.document, console, navigator: globalThis.navigator, ...globals }
  sandbox.globalThis = sandbox
  const context = createContext(sandbox)
  runInContext(source, context, { filename: 'client.js' })
  globalThis.__sandbox = sandbox
  const captured = globalThis.window.__captured
  assert.ok(captured, 'the bundle must register itself with the module loader')
  assert.equal(captured.id, 'dsh-remote')
  return captured.factory((name) => {
    if (name === 'react') return React
    return {}
  })
}

test('the local window gets the panel and the launcher icon, nothing else', () => {
  installDom('127.0.0.1')
  const plugin = loadBundle()
  // Arrays created inside the VM carry that realm's prototypes, so compare copies.
  assert.deepEqual([...plugin.inject], ['slots', 'locale', 'uiWorkspace'])

  const { ctx, registrations } = makeContext()
  plugin.apply(ctx)
  // No download action here: the desktop already owns the file, and this plugin
  // must not add buttons to the native preview header.
  assert.deepEqual([...registrations.keys()].sort(), [
    'main#dsh-remote',
    'sidebar.panellist#dsh-remote',
  ])
  assert.equal(registrations.get('sidebar.panellist#dsh-remote').spec.order, 21)
  assert.equal(registrations.has('shell.bottom#dsh-remote-mobile-nav'), false, 'the loopback window must not register the mobile nav')

  const panel = registrations.get('main#dsh-remote').component
  assert.equal(panel({}).props.className, 'dshr-panel')
})

test('a LAN page also gets the download actions', () => {
  installDom('10.40.16.57')
  const plugin = loadBundle()
  const { ctx, registrations } = makeContext()
  plugin.apply(ctx)
  assert.deepEqual([...registrations.keys()].sort(), [
    'main#dsh-remote',
    'sidebar.panellist#dsh-remote',
    'sidebar.right.tab.document.actions#dsh-remote-download',
    'sidebar.right.tab.document.unpreviewable#dsh-remote-download',
  ])
  const download = registrations.get('sidebar.right.tab.document.actions#dsh-remote-download').component
  assert.equal(download({ absolutePath: 'C:/tmp/a.txt' }).props.className, 'dshr-download')
  assert.equal(download({}), null, 'no path, no button')
})

test('a LAN page injects the stylesheet and keeps the host-path bridge cleared', () => {
  const { nodes } = installDom('10.40.16.57')
  const plugin = loadBundle()
  const { ctx } = makeContext()
  plugin.apply(ctx)

  const style = nodes.find((node) => node.attrs && node.attrs['data-dsh-remote'] !== undefined)
  assert.ok(style, 'the plugin appends one style tag')
  assert.match(style.textContent, /\.dshr-panel\{/)
  assert.match(style.textContent, /html\.dshm-mobile/)

  assert.equal(globalThis.__sandbox.__DSH_HOST_PATHS__, undefined, 'a remote page must not keep the local path bridge')
})

test('the Electron desktop window keeps its host-path bridge', () => {
  installDom('10.40.16.57')
  const bridge = { pathFor: () => 'C:\\tmp\\a.txt' }
  // Presence of the bridge is the desktop marker, so it is present before apply.
  const plugin = loadBundle({ __DSH_HOST_PATHS__: bridge })
  const { ctx } = makeContext()
  plugin.apply(ctx)
  assert.equal(globalThis.__sandbox.__DSH_HOST_PATHS__, bridge, 'a desktop shell is never treated as remote')
})
