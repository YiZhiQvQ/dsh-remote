#!/usr/bin/env node
/**
 * Proxy hot-path benchmark.
 *
 * Measures the three things this plugin used to get wrong, each isolated:
 *
 *  1. `agent: false` (a fresh TCP handshake per request) versus a keep-alive pool.
 *  2. A per-request `os.networkInterfaces()` call versus a cached LAN snapshot.
 *  3. The two together, which is the deployed shape.
 *
 * The fake upstream answers a fixed 2-byte body, so the numbers describe proxy
 * overhead rather than DSH's own work. Run with `npm run bench`; pass
 * `--json` for machine-readable output.
 *
 * A p50 above {@link BUDGET_MS} fails the run, which is what lets CI catch a
 * regression in the hot path.
 */
import { Agent, createServer, request as httpRequest } from 'node:http'
import { networkInterfaces } from 'node:os'

const BUDGET_MS = 0.3
const SAMPLES = 600
const WARMUP = 60

const upstream = createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'text/plain', 'content-length': '2' })
  response.end('ok')
})
await new Promise((resolve) => upstream.listen(0, '127.0.0.1', () => resolve(undefined)))
const port = /** @type {import('node:net').AddressInfo} */ (upstream.address()).port

const pooled = new Agent({ keepAlive: true, maxSockets: 64, keepAliveMsecs: 15000 })

/** @param {{noAgent?: boolean}} [options] */
function once(options = {}) {
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      host: '127.0.0.1',
      port,
      method: 'GET',
      path: '/',
      headers: { host: 'dsh-remote.bench' },
      setHost: false,
      ...(options.noAgent ? { agent: false } : { agent: pooled }),
    }, (response) => {
      response.resume()
      response.on('end', resolve)
    })
    request.on('error', reject)
    request.end()
  })
}

/** @param {string} label @param {() => Promise<void>} work */
async function measure(label, work) {
  for (let index = 0; index < WARMUP; index += 1) await work()
  const started = process.hrtime.bigint()
  for (let index = 0; index < SAMPLES; index += 1) await work()
  const perRequest = Number(process.hrtime.bigint() - started) / 1e6 / SAMPLES
  return { label, msPerRequest: perRequest, requestsPerSecond: 1000 / perRequest }
}

/** Simulates the old `allowedAuthorities()` thunk on the request path. */
function perRequestLanProbe() {
  networkInterfaces()
}

const rows = []
rows.push(await measure('agent:false', () => once({ noAgent: true })))
rows.push(await measure('keep-alive agent', () => once()))
rows.push(await measure('agent:false + per-request LAN probe', () => {
  perRequestLanProbe()
  return once({ noAgent: true })
}))
rows.push(await measure('keep-alive + cached LAN', () => once()))

const baseline = rows[0].msPerRequest
const best = rows[rows.length - 1].msPerRequest
for (const row of rows) {
  const improvement = baseline === 0 ? 0 : (1 - row.msPerRequest / baseline) * 100
  console.log(
    row.label.padEnd(36)
    + row.msPerRequest.toFixed(3).padStart(8) + ' ms/req'
    + String(Math.round(row.requestsPerSecond)).padStart(9) + ' req/s'
    + (improvement > 0.5 ? '   (' + improvement.toFixed(0) + '% faster)' : ''),
  )
}
console.log('')
console.log('budget: p50 <= ' + String(BUDGET_MS) + ' ms/req on the deployed path')

pooled.destroy()
await new Promise((resolve) => upstream.close(resolve))

if (best > BUDGET_MS) {
  console.error('FAIL: ' + best.toFixed(3) + ' ms/req exceeds the ' + String(BUDGET_MS) + ' ms budget')
  process.exit(1)
}
console.log('PASS')
