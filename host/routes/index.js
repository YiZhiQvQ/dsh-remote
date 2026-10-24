/**
 * The `/api/remote/*` routes the browser half calls. Each route is a plain
 * `fetch` handler so it can be unit tested without a listener.
 *
 * @module dsh-remote/host/routes
 */
import { createDownloadHandler } from './download.js'
import { createUploadHandler } from './upload.js'
import { createBrowseHandler } from './browse.js'
import { createQrSvg } from '../media/qr.js'
import { jsonResponse, textResponse } from '../http/respond.js'
import { buildPublicUrl, invalidateLan, lanSnapshot } from '../lan.js'
import { checkPortProxy } from '../net/port-probe.js'
import { debug } from '../log.js'

/**
 * @typedef {object} RoutesOptions
 * @property {any} fs - the DSH filesystem service.
 * @property {number} maxDownloadBytes
 * @property {number} maxUploadBytes
 * @property {boolean} rangeEnabled
 * @property {string} uploadTempSubdir
 * @property {number} uploadTempTtlMs
 * @property {number} listenPort
 * @property {() => number} dshPort
 * @property {() => number} listenPortNow
 * @property {() => {paused: boolean, proxy: object}} proxyState
 * @property {() => Promise<boolean>} pauseProxy
 * @property {() => Promise<boolean>} resumeProxy
 * @property {(text: string) => void} warnOnce
 * @property {number} probeTimeoutMs
 * @property {string[]} configuredWarnings
 */

/**
 * Build every route handler. The caller registers them on the connection fetch
 * registry and disposes the returned map.
 *
 * @param {RoutesOptions} options
 * @returns {Map<string, {path: string, methods: string[], requestBody: 'buffered'|'streaming', fetch: (request: Request) => Promise<Response>}>}
 */
function createRoutes(options) {
  const download = createDownloadHandler({
    fs: options.fs,
    maxBytes: options.maxDownloadBytes,
    rangeEnabled: options.rangeEnabled,
  })
  const upload = createUploadHandler({
    maxBytes: options.maxUploadBytes,
    tempSubdir: options.uploadTempSubdir,
    tempTtlMs: options.uploadTempTtlMs,
  })
  const browse = createBrowseHandler()

  /** @type {{value: boolean, at: number, pending: Promise<boolean>|undefined}} */
  const probe = { value: false, at: 0, pending: undefined }

  /** Run one probe, sharing an in-flight one so concurrent callers cost one socket. */
  function probeNow() {
    if (probe.pending !== undefined) return probe.pending
    const port = options.listenPortNow()
    const running = checkPortProxy(port, '127.0.0.1', options.probeTimeoutMs)
      .catch(() => false)
      .then((value) => {
        probe.value = value
        probe.at = Date.now()
        return value
      })
      .finally(() => {
        probe.pending = undefined
      })
    probe.pending = running
    return running
  }

  /**
   * Whether the LAN listener answers on its port.
   *
   * The answer is cached for a couple of seconds because the panel re-reads this
   * route on every mount, but the *first* read after a listener starts must be
   * real: answering from an empty cache reported "no listener" until the
   * operator pressed refresh, which is exactly the confusing part. A localhost
   * connect resolves at once when the port is open and is refused at once when
   * it is closed, so awaiting the first probe costs nothing in practice and is
   * bounded by `probeTimeoutMs` in the worst case.
   *
   * @returns {Promise<boolean>}
   */
  async function portProxyReachable() {
    // A paused or failed listener is not worth a TCP round trip, and probing it
    // would report the previous answer for a couple of seconds anyway.
    const { proxy } = options.proxyState()
    if (proxy.running !== true) {
      probe.value = false
      probe.at = Date.now()
      return false
    }
    // No answer yet: this is the panel opening, so wait for a real one.
    if (probe.at === 0) return probeNow()
    // A cached answer is good enough here; refresh it for the next read.
    if (probe.pending === undefined && Date.now() - probe.at > 2000) void probeNow()
    return probe.value
  }

  /** @returns {string[]} */
  function currentWarnings() {
    const warnings = [...options.configuredWarnings]
    const rows = lanSnapshot()
    if (rows.length === 0) warnings.push('没有检测到私有 IPv4 地址；请检查网络，或手动配置 allowedHosts。')
    const proxy = options.proxyState()
    if (proxy.proxy.error) warnings.push('LAN 代理启动失败：' + String(proxy.proxy.error))
    return warnings
  }

  /** @param {string} address */
  function mobileUrl(address) {
    return 'http://' + address + ':' + String(options.listenPortNow()) + '/'
  }

  /** @type {Map<string, {path: string, methods: string[], requestBody: 'buffered'|'streaming', fetch: (request: Request) => Promise<Response>}>} */
  const routes = new Map()

  routes.set('/api/remote/info', {
    path: '/api/remote/info',
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: async () => {
      const rows = lanSnapshot()
      const primary = rows.length > 0 ? rows[0].address : '127.0.0.1'
      const proxy = options.proxyState()
      return jsonResponse({
        ok: true,
        lanAddresses: rows,
        publicUrl: buildPublicUrl(rows, options.listenPortNow()),
        paused: proxy.paused,
        dshPort: options.dshPort(),
        listenPort: options.listenPortNow(),
        proxy: proxy.proxy,
        auth: {
          username: proxy.proxy.username,
          source: proxy.proxy.authSource,
          role: 'admin',
          loginUrl: mobileUrl(primary),
        },
        role: 'admin',
        health: proxy.proxy.health,
        portProxyReachable: await portProxyReachable(),
        warnings: currentWarnings(),
      })
    },
  })

  routes.set('/api/remote/pairing', {
    path: '/api/remote/pairing',
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: async () => {
      const rows = lanSnapshot()
      return jsonResponse({
        ok: true,
        urls: rows.map((row) => ({ address: row.address, url: mobileUrl(row.address) })),
      })
    },
  })

  routes.set('/api/remote/qr', {
    path: '/api/remote/qr',
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: async (request) => {
      const address = new URL(request.url).searchParams.get('address')
      if (address === null || !lanSnapshot().some((row) => row.address === address)) return textResponse(400, 'unknown address')
      const svg = await createQrSvg(mobileUrl(address))
      if (svg === undefined) return textResponse(503, 'qrcode dependency unavailable')
      return new Response(svg, {
        headers: {
          'content-type': 'image/svg+xml; charset=utf-8',
          'cache-control': 'private, max-age=300',
        },
      })
    },
  })

  routes.set('/api/remote/download', {
    path: '/api/remote/download',
    methods: ['GET', 'HEAD'],
    requestBody: 'buffered',
    fetch: download,
  })

  routes.set('/api/remote/upload', {
    path: '/api/remote/upload',
    methods: ['POST'],
    requestBody: 'streaming',
    fetch: upload,
  })

  // The remote-only directory browser. The client patches pickDirectory on a
  // LAN page and drives this; the local desktop never calls it.
  routes.set('/api/remote/browse', {
    path: '/api/remote/browse',
    methods: ['GET', 'POST'],
    requestBody: 'buffered',
    fetch: browse,
  })

  routes.set('/api/remote/control', {
    path: '/api/remote/control',
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async (request) => {
      const action = new URL(request.url).searchParams.get('action')
      if (action !== 'pause' && action !== 'resume') return textResponse(400, 'unknown action')
      // Answer first, act afterwards.
      //
      // A pause tears down the very listener this request arrived on when the
      // page is served through the gate. Awaiting the close here means the
      // response never reaches the browser: the socket is destroyed mid-flight
      // and the panel spins until it times out. Scheduling the work lets the
      // body flush, then the listener goes away underneath a request that is
      // already finished.
      const work = action === 'pause' ? options.pauseProxy : options.resumeProxy
      setTimeout(() => {
        void work().catch((error) => debug('routes', 'control ' + action + ' failed: ' + String(error)))
      }, 0)
      // Report the state the operator just asked for, not the state that is still
      // being applied: the panel renders its Pause/Resume button from this field.
      const after = options.proxyState()
      // A resume may follow a network change; drop the cached LAN sample so the
      // panel and the Host fence re-read the interfaces on the next request.
      invalidateLan()
      debug('routes', 'control ' + action + ' scheduled')
      const paused = action === 'pause' ? true : false
      return jsonResponse({
        ok: true,
        scheduled: action,
        paused,
        proxy: { ...after.proxy, running: paused ? false : after.proxy.running },
      })
    },
  })

  return routes
}

export { createRoutes }
