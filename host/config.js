/**
 * Configuration normalization. Every field is declared in {@link FIELD_TABLE}
 * with its coercion and default, so adding an option is one line instead of a
 * new hand-written branch in a 20-line object literal.
 *
 * @module dsh-remote/host/config
 */
import { homedir } from 'node:os'
import { join } from 'node:path'

const DEFAULTS = {
  listenPort: 3080,
  dshPort: 52551,
  maxDownloadBytes: 512 * 1024 * 1024,
  maxUploadBytes: 512 * 1024 * 1024,
  lanSnapshotMs: 5000,
  sessionDays: 30,
  trustProxyHeaders: false,
  probeTimeoutMs: 300,
  keepAliveMaxSockets: 64,
  uploadTempSubdir: '.dsh-remote-tmp',
  uploadTempTtlMs: 60 * 60 * 1000,
  rangeEnabled: true,
}

/** @param {unknown} value @returns {value is number} */
function isInteger(value) {
  return typeof value === 'number' && Number.isInteger(value)
}

/** @param {unknown} value @param {number} fallback @returns {number} */
function port(value, fallback) {
  return isInteger(value) && value > 0 && value <= 65535 ? value : fallback
}

/** @param {unknown} value @param {number} fallback @returns {number} */
function bytes(value, fallback) {
  return isInteger(value) && value > 0 ? value : fallback
}

/** @param {unknown} value @param {number} fallback @returns {number} */
function positiveInt(value, fallback) {
  return isInteger(value) && value > 0 ? value : fallback
}

/** @param {unknown} value @param {string} fallback */
function name(value, fallback) {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

/** @param {unknown} value @param {string[]} fallback */
function stringList(value, fallback) {
  if (!Array.isArray(value)) return fallback
  const rows = value.filter((row) => typeof row === 'string' && row.length > 0)
  return rows.length === 0 ? fallback : rows
}

/**
 * Resolve the effective configuration.
 * @param {Record<string, unknown>} config - the raw plugin config.
 * @returns {{
 *   dshHome: string, listenPort: number, dshPort: number,
 *   maxDownloadBytes: number, maxUploadBytes: number,
 *   lanSnapshotMs: number, sessionDays: number, trustProxyHeaders: boolean,
 *   probeTimeoutMs: number, keepAliveMaxSockets: number,
 *   uploadTempSubdir: string, uploadTempTtlMs: number, rangeEnabled: boolean,
 *   allowedHosts: string[], username?: string, password?: string,
 *   authFile: string, secretFile: string,
 * }}
 */
function normalizeConfig(config) {
  const value = config !== null && typeof config === 'object' ? config : {}
  const dshHome = name(value.dshHome, process.env.DSH_HOME || join(homedir(), '.dsh'))
  return {
    dshHome,
    listenPort: port(value.listenPort, DEFAULTS.listenPort),
    dshPort: port(value.dshPort, DEFAULTS.dshPort),
    maxDownloadBytes: bytes(value.maxDownloadBytes, DEFAULTS.maxDownloadBytes),
    maxUploadBytes: bytes(value.maxUploadBytes, DEFAULTS.maxUploadBytes),
    lanSnapshotMs: positiveInt(value.lanSnapshotMs, DEFAULTS.lanSnapshotMs),
    sessionDays: positiveInt(value.sessionDays, DEFAULTS.sessionDays),
    trustProxyHeaders: value.trustProxyHeaders === true,
    probeTimeoutMs: positiveInt(value.probeTimeoutMs, DEFAULTS.probeTimeoutMs),
    keepAliveMaxSockets: positiveInt(value.keepAliveMaxSockets, DEFAULTS.keepAliveMaxSockets),
    uploadTempSubdir: name(value.uploadTempSubdir, DEFAULTS.uploadTempSubdir),
    uploadTempTtlMs: positiveInt(value.uploadTempTtlMs, DEFAULTS.uploadTempTtlMs),
    rangeEnabled: value.rangeEnabled !== false,
    allowedHosts: stringList(value.allowedHosts, []),
    username: name(value.username, undefined),
    password: name(value.password, undefined),
    authFile: name(value.authFile, join(dshHome, 'dsh-remote-auth.json')),
    secretFile: name(value.secretFile, join(dshHome, 'dsh-remote-secret')),
  }
}

export { normalizeConfig, DEFAULTS }
