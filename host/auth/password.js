/**
 * Password verification off the event loop.
 *
 * `scryptSync` costs ~30 ms on this class of machine and sits on a route anyone
 * on the LAN can hit without credentials. Running the KDF on the libuv pool and
 * capping concurrency keeps a burst of login POSTs from turning into event-loop
 * head-of-line blocking for every other request the proxy is serving.
 *
 * @module dsh-remote/host/auth/password
 */
import { scrypt, timingSafeEqual } from 'node:crypto'
import { debug } from '../log.js'

const MAX_CONCURRENT = 2
let active = 0
/** @type {(() => void)[]} */
const waiting = []

function acquire() {
  if (active < MAX_CONCURRENT) {
    active += 1
    return Promise.resolve()
  }
  return new Promise((resolve) => waiting.push(() => resolve(undefined)))
}

function release() {
  const next = waiting.shift()
  if (next !== undefined) {
    next()
    return
  }
  active -= 1
}

/**
 * @param {string} password
 * @param {Buffer} salt
 * @param {number} length
 * @returns {Promise<Buffer>}
 */
function derive(password, salt, length) {
  return new Promise((resolve, reject) => {
    scrypt(String(password), salt, length, (error, derived) => {
      if (error) reject(error)
      else resolve(derived)
    })
  })
}

/**
 * Compare a submitted password against the resolved credential record.
 * @param {import('./credentials.js').Credentials} credentials
 * @param {string} password
 * @returns {Promise<boolean>}
 */
async function verifyPassword(credentials, password) {
  if (credentials.salt !== undefined && credentials.hash !== undefined) {
    await acquire()
    try {
      const actual = await derive(password, credentials.salt, credentials.hash.length)
      return actual.length === credentials.hash.length && timingSafeEqual(actual, credentials.hash)
    } catch (error) {
      debug('auth', 'scrypt failed: ' + String(error && error.code))
      return false
    } finally {
      release()
    }
  }
  // The config/default sources hold a plaintext password; compare without a KDF
  // but still in constant time so the length of a shared prefix is not leaked.
  const expected = Buffer.from(String(credentials.password || ''), 'utf8')
  const actual = Buffer.from(String(password), 'utf8')
  if (actual.length !== expected.length) {
    timingSafeEqual(expected, expected)
    return false
  }
  return timingSafeEqual(actual, expected)
}

export { verifyPassword, MAX_CONCURRENT }
