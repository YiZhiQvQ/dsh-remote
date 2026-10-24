import test from 'node:test'
import assert from 'node:assert/strict'
import { applyMobileViewport } from '../src/client/mobile/mode.js'

function viewportDocument(userAgent, platform = '', maxTouchPoints = 0) {
  let content = ''
  const meta = {
    setAttribute(name, value) {
      if (name === 'content') content = value
    },
  }
  const document = {
    querySelector: () => meta,
    defaultView: { navigator: { userAgent, platform, maxTouchPoints } },
  }
  return { document, content: () => content }
}

test('android viewport leaves the status-bar inset to the browser', () => {
  const { document, content } = viewportDocument('Mozilla/5.0 (Linux; Android 14; Pixel 5)')
  applyMobileViewport(document)
  assert.ok(!content().includes('viewport-fit=cover'))
  assert.match(content(), /width=device-width/)
})

test('ios viewport keeps cover for the notch safe area', () => {
  const { document, content } = viewportDocument('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')
  applyMobileViewport(document)
  assert.match(content(), /viewport-fit=cover/)
})

test('ipad desktop-mode detection keeps cover', () => {
  const { document, content } = viewportDocument('Mozilla/5.0 (Macintosh)', 'MacIntel', 5)
  applyMobileViewport(document)
  assert.match(content(), /viewport-fit=cover/)
})
