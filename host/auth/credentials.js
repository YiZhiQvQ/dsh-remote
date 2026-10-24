/**
 * Administrator credential resolution: password file > config > built-in default.
 * The file holds a scrypt salt/hash so the plaintext never touches disk.
 *
 * @module dsh-remote/host/auth/credentials
 */
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { debug } from '../log.js'

/**
 * @typedef {object} Credentials
 * @property {string} username
 * @property {Buffer} [salt]
 * @property {Buffer} [hash]
 * @property {string} [password] - only for the config/default sources
 * @property {'file'|'config'|'default'} source
 * @property {string} version - bound into session cookies so a password change revokes them
 */

/**
 * A short fingerprint of the secret material, embedded in every session cookie.
 *
 * It has to be computed here, at load time. Shipping an empty string made
 * `verifySession` compare `''` against `''`, which silently stopped binding
 * sessions to the credential — a password change no longer revoked anything, and
 * a cookie minted against the old fingerprint failed to verify.
 *
 * @param {{salt?: Buffer, hash?: Buffer, password?: string}} record
 * @returns {string}
 */
function versionOf(record) {
  const material = record.hash !== undefined
    ? record.hash.toString('hex')
    : createHash('sha256').update(String(record.password || '')).digest('hex')
  const salt = record.salt === undefined ? '' : record.salt.toString('hex')
  return createHash('sha256').update(salt + '\0' + material).digest('hex').slice(0, 16)
}

/**
 * @param {Record<string, unknown>} options
 * @returns {Credentials}
 */
function loadCredentials(options) {
  if (options.authFile) {
    try {
      const data = JSON.parse(readFileSync(String(options.authFile), 'utf8'))
      if (typeof data.username === 'string' && data.username.length > 0 && typeof data.salt === 'string' && typeof data.hash === 'string') {
        const salt = Buffer.from(data.salt, 'hex')
        const hash = Buffer.from(data.hash, 'hex')
        if (salt.length > 0 && hash.length > 0) {
          return { username: data.username, salt, hash, source: 'file', version: versionOf({ salt, hash }) }
        }
      }
      debug('auth', 'auth file has no usable salt/hash; falling back')
    } catch (error) {
      if (error && error.code !== 'ENOENT') debug('auth', 'auth file unreadable: ' + String(error.code))
    }
  }
  if (typeof options.username === 'string' && options.username.length > 0 && typeof options.password === 'string' && options.password.length > 0) {
    const record = { username: options.username, password: options.password }
    return { ...record, source: 'config', version: versionOf(record) }
  }
  const record = { username: 'admin', password: 'dsh-remote' }
  return { ...record, source: 'default', version: versionOf(record) }
}

export { loadCredentials, versionOf }
