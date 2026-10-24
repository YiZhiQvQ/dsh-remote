/**
 * LAN address selection plus the request-path snapshot.
 *
 * `os.networkInterfaces()` costs ~3 ms of synchronous time on Windows, and the
 * proxy used to call it on every request through a thunk. Nothing on the request
 * path may do that any more: {@link lanSnapshot} answers from a cached sample and
 * refreshes it at most once per TTL.
 *
 * @module dsh-remote/host/lan
 */
import { networkInterfaces } from 'node:os'

const DEFAULT_LISTEN_PORT = 3080

/** RFC1918 plus CGNAT (100.64/10, which Tailscale also hands out). */
const PRIVATE_V4 = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/

/**
 * The same private-range test the bundle patch embeds. Kept as one exported
 * pattern so a contract test can prove the YAML copy has not drifted.
 */
const PRIVATE_V4_SOURCE = PRIVATE_V4.source

const VIRTUAL_NAME = /vmware|virtualbox|vbox|hyper-v|vethernet|docker|wsl|loopback/i
const OVERLAY_NAME = /tailscale|zerotier/i
const PHYSICAL_NAME = /wi-?fi|wlan|ethernet|以太网|无线/i

/**
 * One non-internal private IPv4 candidate per address, ordered by interface
 * preference: physical NICs first, overlays next, virtual adapters last.
 *
 * @param {Record<string, import('node:os').NetworkInterfaceInfo[]|undefined>} [interfaces]
 * @returns {{name: string, address: string}[]}
 */
function selectLanAddresses(interfaces = networkInterfaces()) {
  const rows = []
  for (const [name, list] of Object.entries(interfaces)) {
    for (const iface of list ?? []) {
      if (iface === undefined || iface.family !== 'IPv4' || iface.internal) continue
      if (!PRIVATE_V4.test(iface.address)) continue
      rows.push({ name, address: iface.address })
    }
  }
  const score = (row) => (VIRTUAL_NAME.test(row.name) ? 9 : OVERLAY_NAME.test(row.name) ? 5 : PHYSICAL_NAME.test(row.name) ? 0 : 1)
  rows.sort((a, b) => score(a) - score(b) || a.address.localeCompare(b.address))
  const seen = new Set()
  return rows.filter((row) => {
    if (seen.has(row.address)) return false
    seen.add(row.address)
    return true
  })
}

/** @type {{rows: {name: string, address: string}[], at: number, ttlMs: number}|undefined} */
let snapshot

/**
 * Cached LAN sample. Phone networks change on a minutes scale; a five second
 * TTL is far tighter than any handoff and costs nothing on the request path.
 *
 * @param {number} [ttlMs]
 * @returns {{name: string, address: string}[]}
 */
function lanSnapshot(ttlMs = 5000) {
  const now = Date.now()
  if (snapshot === undefined || now - snapshot.at > (snapshot.ttlMs || ttlMs) || now < snapshot.at) {
    snapshot = { rows: selectLanAddresses(), at: now, ttlMs }
  }
  return snapshot.rows
}

/** Drop the cached sample so the next read re-probes (used after /info). */
function invalidateLan() {
  snapshot = undefined
}

/**
 * Whether a Host header names a private or loopback IPv4 literal. This is the
 * cheap arm of the Host fence: a DNS-rebinding page cannot forge a URL hostname,
 * and browsers send the URL hostname verbatim, so an IP-literal check rejects
 * every rebound name without touching the OS.
 *
 * @param {string} hostname
 * @returns {boolean}
 */
function isPrivateIpLiteral(hostname) {
  if (hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1' || hostname === '[::1]') return true
  return PRIVATE_V4.test(hostname)
}

/**
 * Split a `Host` header into hostname and port (IPv6 literals stay bracketed).
 * @param {string} authority
 * @returns {{hostname: string, port: string}}
 */
function splitAuthority(authority) {
  const value = String(authority || '')
  if (value.startsWith('[')) {
    const end = value.indexOf(']')
    if (end === -1) return { hostname: value, port: '' }
    const rest = value.slice(end + 1)
    return { hostname: value.slice(0, end + 1), port: rest.startsWith(':') ? rest.slice(1) : '' }
  }
  const at = value.lastIndexOf(':')
  if (at === -1) return { hostname: value, port: '' }
  return { hostname: value.slice(0, at), port: value.slice(at + 1) }
}

/**
 * The advertised LAN root, or undefined when no private IPv4 exists.
 * @param {{name: string, address: string}[]} rows
 * @param {number} port
 */
function buildPublicUrl(rows, port = DEFAULT_LISTEN_PORT) {
  const first = rows[0]
  return first === undefined ? undefined : 'http://' + first.address + ':' + String(port) + '/'
}

export {
  DEFAULT_LISTEN_PORT,
  PRIVATE_V4_SOURCE,
  buildPublicUrl,
  invalidateLan,
  isPrivateIpLiteral,
  lanSnapshot,
  selectLanAddresses,
  splitAuthority,
}
