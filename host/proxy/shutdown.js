/**
 * Taking the listener down.
 *
 * Split out of `server.js` because the shutdown policy grew a second mode and
 * the listener file was at its size limit. Two callers with opposite needs share
 * this one function:
 *
 * - **Pause** (`drain: false`, the default) is an operator saying "stop serving
 *   now". Every phone connection ends immediately; nothing waits for a client to
 *   hang up politely.
 * - **Unload** (`drain: true`) is the plugin going away. In-flight responses are
 *   allowed to finish, because a download that dies mid-transfer looks like the
 *   plugin is broken. Idle keep-alive sockets are still dropped at once so the
 *   drain cannot be held open by a browser that is merely sitting there.
 *
 * Either way the returned promise settles only once the port is actually
 * released — that is what makes "disable, then enable" reliable.
 *
 * @module dsh-remote/host/proxy/shutdown
 */

/** How long a pause may take to release the port before we stop waiting. */
const PAUSE_GRACE_MS = 1000
/** How long an unload waits for in-flight responses. */
const DRAIN_GRACE_MS = 5000

/**
 * @param {import('node:http').Server} instance
 * @param {{
 *   drain?: boolean,
 *   upgraded?: Set<import('node:stream').Duplex>,
 *   onStopped?: () => void,
 *   graceMs?: number,
 * }} [options]
 * @returns {Promise<void>}
 */
function closeListener(instance, options = {}) {
  const drain = options.drain === true
  const upgraded = options.upgraded
  const onStopped = typeof options.onStopped === 'function' ? options.onStopped : () => {}
  const graceMs = Number.isInteger(options.graceMs) ? options.graceMs : drain ? DRAIN_GRACE_MS : PAUSE_GRACE_MS

  return new Promise((resolve) => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      onStopped()
      resolve()
    }

    // Upgrade sockets (the event stream) hold their connection open forever, so
    // they are always ended: a drain has no meaning for a stream.
    if (upgraded !== undefined) {
      for (const socket of upgraded) {
        try {
          socket.destroy()
        } catch {
          // Already closed.
        }
      }
      upgraded.clear()
    }

    // An idle keep-alive socket is not work in progress, whatever the mode.
    if (typeof instance.closeIdleConnections === 'function') {
      try {
        instance.closeIdleConnections()
      } catch {
        // Already closed.
      }
    }
    if (!drain && typeof instance.closeAllConnections === 'function') {
      try {
        instance.closeAllConnections()
      } catch {
        // Already closed.
      }
    }

    // The callback still lands asynchronously; the timer is only a backstop for
    // a socket that refuses to die.
    const timer = setTimeout(done, graceMs)
    if (typeof timer.unref === 'function') timer.unref()

    // A drained connection becomes idle the moment its response finishes, and
    // nothing would close it: the browser keeps it alive for the next request.
    // Without this sweep a drain would always run to the full grace period, so
    // every plugin unload would appear to hang for seconds. Re-sweeping turns
    // "wait for the response" into "wait for the response, then leave".
    let sweep
    if (drain && typeof instance.closeIdleConnections === 'function') {
      sweep = setInterval(() => {
        try {
          instance.closeIdleConnections()
        } catch {
          // Already closed.
        }
      }, 50)
      if (typeof sweep.unref === 'function') sweep.unref()
    }

    const settle = () => {
      clearTimeout(timer)
      if (sweep !== undefined) clearInterval(sweep)
      done()
    }
    try {
      instance.close(settle)
    } catch {
      settle()
    }
  })
}

export { closeListener, PAUSE_GRACE_MS, DRAIN_GRACE_MS }
