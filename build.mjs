#!/usr/bin/env node
/**
 * Bundle `src/client/**` into the single `client.js` the DSH module loader
 * serves. The loader contract is one CJS-shaped factory per package, so the
 * output has to be one classic script — no code splitting, no ESM output.
 *
 * Usage:
 *   node build.mjs            write client.js
 *   node build.mjs --check    exit 1 when client.js is stale (CI gate)
 *   node build.mjs --watch    rebuild on change
 */
import { build, context } from 'esbuild'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(fileURLToPath(import.meta.url))
const outfile = join(root, 'client.js')

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: [join(root, 'src', 'client', 'entry.js')],
  outfile,
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  charset: 'utf8',
  legalComments: 'none',
  // CSS arrives as text and JSON as a parsed object; both end up in the bundle,
  // which is what the loader can serve.
  loader: { '.css': 'text', '.json': 'json' },
  // Keep identifiers readable: the artefact is committed, reviewed in diffs, and
  // debugged on a phone over a LAN cable.
  minifyWhitespace: true,
  minifySyntax: true,
  minifyIdentifiers: false,
  sourcemap: false,
}

const mode = process.argv.includes('--watch') ? 'watch' : process.argv.includes('--check') ? 'check' : 'write'

if (mode === 'check') {
  const result = await build({ ...options, write: false })
  const produced = result.outputFiles[0].text
  const current = await readFile(outfile, 'utf8').catch(() => '')
  if (current !== produced) {
    console.error('client.js is out of date with src/client; run "npm run build" and commit the result.')
    process.exit(1)
  }
  console.log('client.js matches src/client')
} else if (mode === 'watch') {
  const ctx = await context(options)
  await ctx.watch()
  console.log('watching src/client…')
} else {
  const result = await build(options)
  if (result.errors.length > 0) {
    console.error('build failed')
    process.exit(1)
  }
  const text = await readFile(outfile, 'utf8')
  console.log('client.js written: ' + String(Buffer.byteLength(text)) + ' bytes')
}
