/**
 * dsh-remote — Host half.
 *
 * A single-admin LAN gateway for the DSH desktop Web GUI. There is no member
 * account, child host, workspace isolation, or read guard: the person who logs
 * in is the same operator as the desktop, and every request targets the same
 * DSH process. The plugin adds an authenticated reverse proxy plus the pairing,
 * download, and upload routes the browser half uses.
 *
 * This file only assembles: configuration comes from `host/config.js`, the
 * proxy from `host/proxy/server.js`, and the `/api/remote/*` handlers from
 * `host/routes/`.
 *
 * @module dsh-remote
 */
import { normalizeConfig } from './host/config.js'
import { startLanProxy } from './host/proxy/server.js'
import { createRoutes } from './host/routes/index.js'
import { checkPortProxy } from './host/net/port-probe.js'
import { lanSnapshot } from './host/lan.js'
import { info, warn } from './host/log.js'

export const name = 'dsh-remote'
export const inject = ['webServer', 'webApp', 'connection', 'fs']

/** @param {string} value */
function safeUrl(value) {
  try {
    return new URL(value)
  } catch {
    return undefined
  }
}

/**
 * Resolve the loopback URL DSH advertises and the launch token it accepts.
 * Asking for the loopback URL is what yields a token; the LAN URL can answer
 * with none, which would leave the proxy forwarding unauthenticated requests.
 *
 * @param {any} ctx
 * @param {string} protocol
 * @param {number} dshPort
 */
function resolveUpstream(ctx, protocol, dshPort) {
  let advertised
  try {
    advertised = safeUrl(ctx.webApp.getAdvertisedUrl())
  } catch {
    advertised = undefined
  }
  let token
  try {
    const tokenUrl = new URL(ctx.connection.authenticatedUrl(protocol + '//127.0.0.1:' + String(dshPort)))
    token = tokenUrl.searchParams.get('token') || undefined
  } catch {
    token = undefined
  }
  return { advertised, token }
}

/**
 * Single-admin LAN gateway: one operator, one DSH process, no isolation.
 * @param {any} ctx - Cordis context.
 * @param {Record<string, unknown>} [config]
 */
export function apply(ctx, config) {
  const options = normalizeConfig(config)
  const dshPort = ctx.webServer.port
  const protocol = typeof ctx.webServer.protocol === 'string' ? ctx.webServer.protocol : 'http:'
  const { advertised, token } = resolveUpstream(ctx, protocol, dshPort)

  const advertisedPort = advertised !== undefined && advertised.port !== '' ? Number(advertised.port) : undefined
  // A loopback publicUrl often names the DSH port itself; binding the proxy there
  // would collide with the server, so fall back to the configured port.
  const listenPort = advertisedPort !== undefined && advertisedPort !== dshPort ? advertisedPort : options.listenPort

  const configuredWarnings = []
  if (dshPort !== options.dshPort) {
    configuredWarnings.push('DSH 实际端口 ' + String(dshPort) + ' 与插件配置 ' + String(options.dshPort) + ' 不一致；代理已按实际端口转发。')
  }
  for (const message of configuredWarnings) warn(message)

  const proxy = startLanProxy({
    listenPort,
    targetHost: '127.0.0.1',
    targetPort: dshPort === undefined ? options.dshPort : dshPort,
    dshToken: token,
    allowedHosts: options.allowedHosts,
    sessionDays: options.sessionDays,
    keepAliveMaxSockets: options.keepAliveMaxSockets,
    trustProxyHeaders: options.trustProxyHeaders,
    authFile: options.authFile,
    secretFile: options.secretFile,
    username: options.username,
    password: options.password,
  })

  let paused = false
  let transition = Promise.resolve()

  /**
   * Serialise pause/resume so a double click cannot interleave listen/close.
   * @template T
   * @param {() => Promise<T>} work
   * @returns {Promise<T>}
   */
  function serialize(work) {
    const next = transition.then(work, work)
    transition = next.then(() => undefined, () => undefined)
    return next
  }

  function pauseProxy() {
    // Record the intent before the await: the panel re-reads /info immediately
    // after its control call, and the socket teardown below can take a moment
    // when an event stream is open.
    if (paused) return Promise.resolve(true)
    paused = true
    return serialize(async () => {
      await proxy.close()
      return true
    }).catch((error) => {
      paused = false
      warn('pause failed: ' + String(error && error.message ? error.message : error))
      return false
    })
  }

  function resumeProxy() {
    if (!paused && proxy.state.phase === 'running') return Promise.resolve(true)
    paused = false
    return serialize(async () => {
      if (proxy.state.phase === 'running') return true
      const ok = await proxy.start()
      paused = !ok
      return ok
    }).catch((error) => {
      warn('resume failed: ' + String(error && error.message ? error.message : error))
      return false
    })
  }

  void proxy.start().catch((error) => warn('proxy start failed: ' + String(error && error.message ? error.message : error)))

  ctx.effect(() => () => {
    // Return the promise: Cordis awaits whatever an effect disposer returns, and
    // that is what makes "disable then enable" reliable. Closing in the
    // background let the next activation listen on a port this listener still
    // held, so a toggle could come back with a dead LAN port.
    //
    // Drain rather than drop: a plugin unload is not the operator pressing
    // Pause, so an in-flight download should finish instead of being cut off
    // mid-response. The idle sweep in `closeListener` keeps that from costing
    // the full grace period on every unload.
    return proxy.close({ drain: true }).then(
      () => proxy.dispose(),
      (error) => {
        // Never leave the pooled sockets and timers behind, even if the close
        // itself failed: the next activation builds its own proxy.
        warn('LAN proxy teardown failed: ' + String(error && error.message ? error.message : error))
        proxy.dispose()
      },
    )
  }, 'dsh-remote: LAN proxy')

  const routes = createRoutes({
    fs: ctx.fs,
    maxDownloadBytes: options.maxDownloadBytes,
    maxUploadBytes: options.maxUploadBytes,
    rangeEnabled: options.rangeEnabled,
    uploadTempSubdir: options.uploadTempSubdir,
    uploadTempTtlMs: options.uploadTempTtlMs,
    listenPort,
    dshPort: () => dshPort,
    listenPortNow: () => proxy.state.listenPort,
    proxyState: () => ({
      paused,
      proxy: {
        running: proxy.state.phase === 'running',
        phase: proxy.state.phase,
        error: proxy.state.error,
        listenPort: proxy.state.listenPort,
        username: proxy.state.username,
        authSource: proxy.state.authSource,
        health: {
          requests: proxy.state.requests,
          upstreamErrors: proxy.state.upstreamErrors,
          authFailures: proxy.state.authFailures,
          rateLimited: proxy.state.rateLimited,
        },
      },
    }),
    pauseProxy,
    resumeProxy,
    warnOnce: warn,
    probeTimeoutMs: options.probeTimeoutMs,
    configuredWarnings,
  })

  ctx.effect(() => {
    const disposers = []
    for (const route of routes.values()) {
      disposers.push(ctx.connection.fetch.register({
        path: route.path,
        methods: route.methods,
        requestBody: route.requestBody,
        fetch: route.fetch,
      }))
    }
    return () => {
      for (const dispose of disposers) {
        try {
          dispose()
        } catch {
          // The route may already be disposed during a hot reload.
        }
      }
    }
  }, 'dsh-remote: routes')

  const rows = lanSnapshot()
  info('LAN ' + (rows.map((row) => row.address).join(', ') || '(none)')
    + '; DSH 127.0.0.1:' + String(dshPort)
    + '; proxy :' + String(listenPort)
    + '; auth ' + proxy.state.username + ' (' + proxy.state.authSource + ')'
    + '; token ' + (token === undefined ? 'missing' : 'present'))
}

export { checkPortProxy }
