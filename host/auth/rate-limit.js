/**
 * Login attempt throttling.
 *
 * The map used to grow without bound and shared one bucket per NAT address.
 * This keeps a bounded LRU: an entry is dropped on sweep once its window has
 * expired, and the oldest entry is evicted when the cap is reached.
 *
 * @module dsh-remote/host/auth/rate-limit
 */

const MAX_ATTEMPTS = 5
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000
const MAX_ENTRIES = 1024
const SWEEP_MS = 10 * 60 * 1000

/**
 * @typedef {object} RateLimiter
 * @property {(key: string) => boolean} isBlocked - true when the caller is over budget.
 * @property {(key: string) => void} recordFailure
 * @property {(key: string) => void} clear
 * @property {() => void} sweep
 * @property {() => number} size
 * @property {() => void} stop
 */

/**
 * @param {{maxAttempts?: number, windowMs?: number, maxEntries?: number, sweepMs?: number}} [options]
 * @returns {RateLimiter}
 */
function createRateLimiter(options = {}) {
  const maxAttempts = Number.isInteger(options.maxAttempts) ? options.maxAttempts : MAX_ATTEMPTS
  const windowMs = Number.isInteger(options.windowMs) ? options.windowMs : ATTEMPT_WINDOW_MS
  const maxEntries = Number.isInteger(options.maxEntries) ? options.maxEntries : MAX_ENTRIES
  const sweepMs = Number.isInteger(options.sweepMs) ? options.sweepMs : SWEEP_MS
  /** @type {Map<string, {count: number, at: number}>} */
  const attempts = new Map()

  function sweep() {
    const now = Date.now()
    for (const [key, record] of attempts) {
      if (now - record.at > windowMs) attempts.delete(key)
    }
  }

  const timer = setInterval(sweep, sweepMs)
  if (typeof timer.unref === 'function') timer.unref()

  return {
    isBlocked(key) {
      const record = attempts.get(key)
      if (record === undefined) return false
      if (Date.now() - record.at > windowMs) {
        attempts.delete(key)
        return false
      }
      return record.count >= maxAttempts
    },
    recordFailure(key) {
      const now = Date.now()
      const record = attempts.get(key)
      if (record === undefined || now - record.at > windowMs) {
        attempts.set(key, { count: 1, at: now })
      } else {
        record.count += 1
        record.at = now
      }
      // Bound the map even when every key is fresh: evict the oldest insertion.
      while (attempts.size > maxEntries) {
        const oldest = attempts.keys().next()
        if (oldest.done) break
        attempts.delete(oldest.value)
      }
    },
    clear(key) {
      attempts.delete(key)
    },
    sweep,
    size() {
      return attempts.size
    },
    stop() {
      clearInterval(timer)
    },
  }
}

export { createRateLimiter, MAX_ATTEMPTS, ATTEMPT_WINDOW_MS, MAX_ENTRIES }
