/**
 * QR code rendering with a small result cache.
 *
 * The pairing panel asks for one SVG per address every time it mounts; the code
 * for a given address never changes, so regenerating it is pure waste. `qrcode`
 * stays an optional dependency: when it is missing the route degrades to 503
 * instead of failing the plugin.
 *
 * @module dsh-remote/host/media/qr
 */
import { debug } from '../log.js'

const TTL_MS = 5 * 60 * 1000
const MAX_ENTRIES = 16

/** @type {Map<string, {svg: string, at: number}>} */
const cache = new Map()
/** @type {Promise<unknown>|undefined} */
let modulePromise

function loadModule() {
  if (modulePromise === undefined) {
    modulePromise = import('qrcode').then((module) => (module.default === undefined ? module : module.default)).catch((error) => {
      debug('qr', 'qrcode unavailable: ' + String(error && error.message ? error.message : error))
      return undefined
    })
  }
  return modulePromise
}

/**
 * @param {string} text
 * @returns {Promise<string|undefined>} SVG markup, or undefined when unavailable.
 */
async function createQrSvg(text) {
  const now = Date.now()
  const hit = cache.get(text)
  if (hit !== undefined && now - hit.at < TTL_MS) return hit.svg
  const qr = await loadModule()
  if (qr === undefined) return undefined
  try {
    // The optional dependency is untyped here; the call shape is qrcode's documented one.
    const render = /** @type {(value: string, options: object) => Promise<string>} */ (/** @type {unknown} */ (qr.toString))
    const svg = await render(text, { type: 'svg', margin: 1, width: 240, errorCorrectionLevel: 'M' })
    cache.set(text, { svg, at: now })
    while (cache.size > MAX_ENTRIES) {
      const oldest = cache.keys().next()
      if (oldest.done) break
      cache.delete(oldest.value)
    }
    return svg
  } catch (error) {
    debug('qr', 'render failed: ' + String(error && error.message ? error.message : error))
    return undefined
  }
}

function clearQrCache() {
  cache.clear()
}

export { createQrSvg, clearQrCache }
