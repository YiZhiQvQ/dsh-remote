import test from 'node:test'
import assert from 'node:assert/strict'
import { ANCHORS } from '../src/client/mobile/anchors.js'
import { probe, publish } from '../src/client/mobile/gate.js'
import { read as readChrome, subscribe, current, applyClasses } from '../src/client/mobile/chrome.js'

/**
 * A document stub that answers the selectors the mobile layer uses. The point of
 * these tests is the contract between DSH's DOM and this plugin's anchors, so the
 * stub is driven by that same table rather than by hand-written selector strings.
 */
function makeDocument(present) {
  const classes = new Set()
  return {
    documentElement: {
      classList: {
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
        contains: (name) => classes.has(name),
        toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)),
      },
      attributes: {},
      setAttribute(name, value) { this.attributes[name] = value },
      removeAttribute(name) { delete this.attributes[name] },
      hasAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name) },
    },
    classes,
    querySelector(selector) {
      if (selector === '[data-shell-bottom]') {
        if (present.shell === false) return null
        // The frame stores the *collapsed* flag; the drawer is open when it is absent.
        return { parentElement: { hasAttribute: (name) => name === 'data-sidebar-collapsed' && present.drawerOpen !== true } }
      }
      if (selector === '[data-sidebar-right-panel][data-sidebar-right-open]') {
        return present.rightOpen === true ? {} : null
      }
      return null
    },
  }
}

test('the anchor table keeps exactly one required set and no duplicate ids', () => {
  const ids = ANCHORS.map((anchor) => anchor.id)
  assert.equal(new Set(ids).size, ids.length, 'anchor ids must be unique')
  const required = ANCHORS.filter((anchor) => anchor.required).map((anchor) => anchor.id)
  assert.deepEqual(required, ['shellRoot'], 'only the frame row is guaranteed on first paint; everything else mounts lazily')
  for (const anchor of ANCHORS) {
    assert.equal(typeof anchor.selector, 'string')
    assert.ok(anchor.selector.length > 0)
    assert.equal(typeof anchor.purpose, 'string')
    assert.ok(anchor.purpose.length > 0, anchor.id + ' needs a stated purpose')
  }
})

test('hashed CSS-module selectors are never required', () => {
  for (const anchor of ANCHORS) {
    if (anchor.selector.includes('[class*=')) {
      assert.equal(anchor.required, false, anchor.id + ' depends on a build-generated class name and must be optional')
    }
  }
})

test('the gate passes when every required anchor is present', () => {
  const document = makeDocument({ shell: true, rightOpen: false })
  // A stub that answers only the two required anchors still counts as healthy:
  // everything else is optional by construction.
  const caps = probe({
    querySelector(selector) {
      if (selector === '[data-shell-bottom]') return {}
      if (selector === '[data-sidebar-right-panel]') return {}
      return null
    },
  })
  assert.equal(caps.ok, true)
  assert.deepEqual(caps.missing, [])
  assert.ok(caps.missingOptional.length > 0, 'optional anchors are reported for diagnosis')
  assert.ok(document.classes.size >= 0)
})

test('the gate refuses the layer when a required anchor is missing', () => {
  const caps = probe({
    querySelector() {
      return null
    },
  })
  assert.equal(caps.ok, false)
  assert.deepEqual(caps.missing, ['shellRoot'])
})

test('a lazily mounted right column never gates the layer', () => {
  // sidebar-right mounts its container on first use, so requiring it would keep
  // the mobile layer switched off on a freshly loaded page.
  const caps = probe({
    querySelector(selector) {
      if (selector === '[data-shell-bottom]') return {}
      return null
    },
  })
  assert.equal(caps.ok, true, 'the frame row alone is enough to install the layer')
  assert.equal(caps.missing.includes('rightPanel'), false)
})

test('the gate publishes the missing anchors on the root element', () => {
  const document = makeDocument({ shell: true, rightOpen: false })
  publish(document.documentElement, { ok: false, missing: ['shellRoot'], missingOptional: [], ready: true })
  assert.equal(document.documentElement.attributes['data-dshm-caps'], 'missing:shellRoot')
  publish(document.documentElement, { ok: true, missing: [], missingOptional: [], ready: true })
  assert.equal(document.documentElement.attributes['data-dshm-caps'], undefined)
})

test('a probe that throws on an exotic selector reports absence instead of failing', () => {
  const caps = probe({
    querySelector(selector) {
      // The hashed-class anchors are the ones most likely to meet a selector the
      // engine rejects; a thrown probe must degrade, not abort the whole scan.
      if (selector.includes('[class*=')) throw new SyntaxError('unsupported selector')
      if (selector === '[data-shell-bottom]') return {}
      if (selector === '[data-sidebar-right-panel]') return {}
      return null
    },
  })
  assert.equal(caps.ok, true, 'a brittle selector must not take the layer down')
  assert.ok(caps.missingOptional.some((id) => id === 'sidebarCol'), 'the failed anchor is reported as missing')
})

test('chrome state publishes only real changes', () => {
  const seen = []
  const stop = subscribe((state) => seen.push(state.view))
  try {
    const document = makeDocument({ shell: true, rightOpen: false, drawerOpen: false })
    readChrome(document, undefined, 'dsh-remote')
    const afterFirst = seen.length
    readChrome(document, undefined, 'dsh-remote')
    assert.equal(seen.length, afterFirst, 'an unchanged read must not notify subscribers')
    assert.equal(current().view, 'chat')

    const rightOpen = makeDocument({ shell: true, rightOpen: true, drawerOpen: false })
    readChrome(rightOpen, undefined, 'dsh-remote')
    assert.equal(current().view, 'files')
    assert.equal(seen[seen.length - 1], 'files')
  } finally {
    stop()
  }
})

test('a panel selection maps to the More surface', () => {
  const document = makeDocument({ shell: true, rightOpen: false, drawerOpen: false })
  readChrome(document, { activePanelId: 'dsh-remote' }, 'dsh-remote')
  assert.equal(current().view, 'more')
  readChrome(document, { activePanelId: null }, 'dsh-remote')
  assert.equal(current().view, 'chat')
})

test('drawer state follows the frame attribute', () => {
  const classes = new Set()
  const document = {
    documentElement: {
      classList: {
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
        contains: (name) => classes.has(name),
      },
    },
    querySelector(selector) {
      // Drawer open == the collapsed flag is absent.
      if (selector === '[data-shell-bottom]') return { parentElement: { hasAttribute: () => false } }
      return null
    },
  }
  const state = readChrome(document, undefined, 'dsh-remote')
  assert.equal(state.drawerOpen, true)
  assert.equal(current().view, 'sessions')

  // The class mirroring lives in applyClasses, which the install path calls once
  // per frame; assert it directly rather than through the reader.
  applyClasses(document, state)
  assert.equal(classes.has('dshm-sidebar-open'), true)
  applyClasses(document, { ...state, drawerOpen: false })
  assert.equal(classes.has('dshm-sidebar-open'), false)
})
