/**
 * TCP reachability probe for the LAN listener, without an HTTP request.
 * @module dsh-remote/host/net/port-probe
 */
import { connect } from 'node:net'

/**
 * @param {number} port
 * @param {string} [host]
 * @param {number} [timeoutMs]
 * @returns {Promise<boolean>}
 */
function checkPortProxy(port, host = '127.0.0.1', timeoutMs = 500) {
  return new Promise((resolve) => {
    let settled = false
    const socket = connect({ port, host })
    const done = (value) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(value)
    }
    socket.setTimeout(timeoutMs, () => done(false))
    socket.once('connect', () => done(true))
    socket.once('error', () => done(false))
  })
}

export { checkPortProxy }
