import test from 'node:test'
import assert from 'node:assert/strict'
import { installUrlCompat, parseNonSpecial, needsRepair } from '../src/client/url-compat.js'

/**
 * The URL shim that makes document previews work on ArkWeb.
 *
 * DSH derives a resource's protocol with `new URL(address).hostname`. On the
 * affected HarmonyOS kernel that hostname comes back empty for the plugin's
 * `dsh-resource://` scheme, so the resource registry finds no provider, settles
 * on `status: "none"`, and the preview reports "the file resource service is
 * unavailable" without issuing a request.
 */

const ADDRESS = 'dsh-resource://file/session/session-75c1ebcb/bench/proxy.mjs'

test('a non-special URL is parsed per the standard', () => {
  const parsed = parseNonSpecial(ADDRESS)
  assert.equal(parsed.protocol, 'dsh-resource:')
  assert.equal(parsed.hostname, 'file')
  assert.equal(parsed.pathname, '/session/session-75c1ebcb/bench/proxy.mjs')
})

test('the address DSH actually uses yields the file protocol', () => {
  // This is the exact decision the preview makes: hostname must be "file".
  assert.equal(parseNonSpecial(ADDRESS).hostname, 'file')
  assert.equal(parseNonSpecial('dsh-resource://plan/x').hostname, 'plan')
})

test('query, fragment and port survive the hand parse', () => {
  const parsed = parseNonSpecial('dsh-resource://file:8080/a/b?x=1#frag')
  assert.equal(parsed.hostname, 'file')
  assert.equal(parsed.port, '8080')
  assert.equal(parsed.search, '?x=1')
  assert.equal(parsed.hash, '#frag')
})

test('a native parser that already works is never replaced', () => {
  const before = globalThis.URL
  const result = installUrlCompat(globalThis)
  assert.equal(result.applied, false, 'node parses these correctly, so nothing is patched')
  assert.equal(globalThis.URL, before, 'the native constructor is untouched')
})

test('a kernel that returns an empty hostname gets a working URL', () => {
  // Simulate the affected kernel: hostname is empty for a non-special scheme.
  class BrokenURL {
    constructor(input) {
      this.href = String(input)
      this.protocol = 'dsh-resource:'
      this.hostname = ''
      this.pathname = '/'
      this.search = ''
      this.hash = ''
    }
  }
  const scope = { URL: BrokenURL }

  // Before: the preview cannot find a provider.
  assert.equal(new scope.URL(ADDRESS).hostname, '')

  const result = installUrlCompat(scope)
  assert.equal(result.applied, true)

  const fixed = new scope.URL(ADDRESS)
  assert.equal(fixed.hostname, 'file', 'the protocol is now derivable')
  assert.equal(fixed.protocol, 'dsh-resource:')
  assert.equal(fixed.pathname, '/session/session-75c1ebcb/bench/proxy.mjs')
})

test('the repaired URL never throws "Illegal invocation"', () => {
  // The first version created the result from `URL.prototype`, whose accessors
  // need internal slots the object did not have — so reading any field threw.
  // Every property a resource lookup touches must be plain data.
  class BrokenURL {
    constructor(input) {
      this.href = String(input)
      this.protocol = 'dsh-resource:'
      this.hostname = ''
    }
  }
  const scope = { URL: BrokenURL }
  installUrlCompat(scope)

  const fixed = new scope.URL(ADDRESS)
  // Reading each field must not throw, and must return the right value.
  assert.doesNotThrow(() => {
    void fixed.protocol
    void fixed.hostname
    void fixed.host
    void fixed.port
    void fixed.pathname
    void fixed.search
    void fixed.hash
    void fixed.href
  })
  assert.equal(fixed.hostname, 'file')
  assert.equal(fixed.host, 'file')
})

test('special schemes are left to the native parser', () => {
  class BrokenURL {
    constructor(input) {
      this.href = String(input)
      this.protocol = 'https:'
      this.hostname = ''
    }
  }
  const scope = { URL: BrokenURL }
  installUrlCompat(scope)
  // A special scheme with an empty hostname is the native parser's business.
  assert.equal(needsRepair('https://example.com/x', new scope.URL('https://example.com/x')), false)
})

test('the shim is inert without a URL constructor', () => {
  assert.deepEqual(installUrlCompat({}), { applied: false })
  assert.deepEqual(installUrlCompat(undefined), { applied: false })
})
