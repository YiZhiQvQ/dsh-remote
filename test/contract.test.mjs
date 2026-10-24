import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { PRIVATE_V4_SOURCE } from '../host/lan.js'
import { ANCHORS } from '../src/client/mobile/anchors.js'

const root = dirname(fileURLToPath(import.meta.url))
const read = (name) => readFile(join(root, '..', name), 'utf8')

/**
 * Contract tests pin the facts that a refactor must not quietly change: the
 * selectors and slot names this plugin borrows from DSH, and the invariants the
 * package promises about its own shape.
 */

test('the LAN module remains the only source of the private IPv4 pattern', async () => {
  const lan = await read('host/lan.js')
  assert.ok(lan.includes(PRIVATE_V4_SOURCE), 'the pattern source is defined in host/lan.js')
  assert.ok(PRIVATE_V4_SOURCE.includes('192\\.168\\.'), 'the pattern still covers the common home ranges')

  // The bundle patch no longer duplicates the pattern: the Host fence in the
  // proxy accepts private IP literals directly, so the YAML has nothing to copy.
  const patch = await read('cordis.patch.yml')
  // The comment explains why the fence is *not* widened, so look for the config
  // key rather than the word.
  assert.equal(/^\s*trustedHosts:/m.test(patch), false, 'the widened trust fence must stay out of the patch')
  assert.equal(patch.includes('192\\.168\\.'), false, 'no second copy of the range pattern')
})

test('the client registers only slots it declares in one place', async () => {
  const app = await read('src/client/app.js')
  const used = new Set()
  for (const match of app.matchAll(/ctx\.slots\.inject\('([^']+)'/g)) used.add(match[1])
  assert.deepEqual([...used].sort(), [
    'main',
    'shell.bottom',
    'sidebar.panellist',
    'sidebar.right.tab.document.actions',
    'sidebar.right.tab.document.unpreviewable',
  ])
  // The two document slots are remote-only: the local window must keep its
  // native preview header untouched.
  assert.match(app, /if \(isRemoteOrigin\(\)\) \{/, 'the download action must be gated on a remote origin')
  for (const name of used) {
    const registered = new RegExp("name: '" + name.replace(/\./g, '\\.') + "'")
    assert.ok(registered.test(app), 'slot "' + name + '" is injected but never registered')
  }
})

test('every runtime module stays small enough to navigate', async () => {
  const files = await listRuntimeFiles()
  for (const file of files) {
    const text = await read(file)
    const lines = text.split('\n').length
    assert.ok(lines <= 400, file + ' has ' + String(lines) + ' lines; split it before it grows further')
  }
  assert.ok(files.length > 20, 'the runtime is expected to be split into focused modules')
})

test('no multi-account surface survives in the single-admin plugin', async () => {
  const files = await listRuntimeFiles()
  const offenders = []
  for (const file of files) {
    const text = await read(file)
    for (const symbol of ['resolveTarget', 'resolveAccount', 'authDisabled', 'rewriteUpstream', 'isHostOpenPath', 'multiAccount']) {
      if (text.includes(symbol)) offenders.push(file + ' -> ' + symbol)
    }
  }
  assert.deepEqual(offenders, [])
})

test('the client bundle is built from src, not hand-edited', async () => {
  const bundle = await read('client.js')
  assert.match(bundle, /__ModuleLoader__/, 'the loader contract is preserved')
  assert.equal(bundle.includes('const MOBILE_CSS'), false, 'CSS is imported as a file, not embedded by hand')
  assert.equal(bundle.includes('const en = {'), false, 'dictionaries come from locale/*.json')
  // The remote directory dialog is ~14 KB of dialog + CSS; keep a guard against
  // hand-edited growth, not a byte-for-byte ceiling.
  assert.ok(Buffer.byteLength(bundle) < 96_000, 'the bundle stays within the size budget')
})

test('the package ships only the runtime surface', async () => {
  const manifest = JSON.parse(await read('package.json'))
  assert.deepEqual(manifest.files, [
    'index.js',
    'client.js',
    'cordis.patch.yml',
    'host',
    'locale/*.json',
    'scripts/set-remote-password.mjs',
    'scripts/set-remote-password.ps1',
    'docs/DESIGN.md',
    'docs/DEPLOYMENT.md',
    'docs/MOBILE.md',
    'docs/OPTIMIZATION.md',
    'docs/images',
    'README.md',
    'CHANGELOG.md',
    'LICENSE',
  ])
  assert.equal(manifest.exports['.'], './index.js')
  assert.equal(manifest.exports['./client'], './client.js')
  assert.ok(manifest.scripts.build !== undefined)
  assert.ok(manifest.scripts.bench !== undefined)
})

test('locale dictionaries stay in step', async () => {
  const en = JSON.parse(await read('locale/en.json'))
  const zh = JSON.parse(await read('locale/zh.json'))
  const enKeys = Object.keys(en.plugin).sort()
  const zhKeys = Object.keys(zh.plugin).sort()
  assert.deepEqual(zhKeys, enKeys, 'both dictionaries must carry the same keys')
  assert.ok(enKeys.length > 40, 'the panel is fully translated')
  assert.equal(Object.values(en.plugin).some((value) => typeof value !== 'string'), false)
})

test('the mobile stylesheet has no unterminated rule', async () => {
  // A rule that opens a block and never closes it silently swallows every
  // declaration after it: the whole header block was dropped this way, which is
  // why the conversation header painted over panels that should have covered it.
  const css = await read('src/client/styles/mobile.css')
  const lines = css.split('\n')
  let depth = 0
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const open = (line.match(/\{/g) || []).length
    const close = (line.match(/\}/g) || []).length
    const before = depth
    depth += open - close
    assert.ok(depth >= 0, 'line ' + String(index + 1) + ' closes a block that was never opened')
    if (before === 0 && open > close && !line.trim().startsWith('@media')) {
      assert.fail('line ' + String(index + 1) + ' opens a block without closing it: ' + line.trim().slice(0, 80))
    }
  }
  assert.equal(depth, 0, 'the stylesheet must end with every block closed')
})

test('the header keeps the stacking order its panels rely on', async () => {
  const css = await read('src/client/styles/mobile.css')
  // The base rule is the one carrying the stacking declarations, not the
  // drawer-open override that also targets the header.
  const base = [...css.matchAll(/header:has\(\[data-conversation-header-leading\]\)\{([^}]*)\}/g)]
    .map((match) => match[1])
    .find((body) => body.includes('z-index:1000'))
  assert.ok(base, 'the conversation header must keep its z-index:1000 rule')
  assert.match(base, /overflow:visible/, 'the header must not clip the menus anchored to it')
  assert.match(base, /position:relative/, 'the z-index only applies to a positioned element')
  // Panels that must cover the header declare their own, higher layer.
  assert.match(css, /\[role=menu\]\{z-index:1200/)
})

test('the settings surface stacks on a phone instead of keeping its desktop rail', async () => {
  // DSH renders settings as an 800px panel beside a 188px rail. Clamped to a phone
  // viewport that leaves ~154px for the content, which collapses every card to one
  // character per line. The mobile layer must stack the rail on top instead.
  const css = await read('src/client/styles/mobile.css')
  assert.match(css, /html\.dshm-mobile \.wCInkW_panel\{[^}]*flex-direction:column/, 'the panel must stack')
  assert.match(css, /html\.dshm-mobile \.wCInkW_panel\{[^}]*width:100vw/, 'the panel must take the viewport')
  assert.match(css, /html\.dshm-mobile \.wCInkW_nav\{[^}]*width:100%/, 'the rail becomes a full-width strip')
  assert.match(css, /html\.dshm-mobile \.wCInkW_navList\{[^}]*flex-direction:row/, 'the rail items become a horizontal tab strip')
  assert.match(css, /html\.dshm-mobile \.wCInkW_navList\{[^}]*overflow-x:auto/, 'the strip scrolls sideways')
})

test('every mobile class the stylesheet targets is actually applied', async () => {
  // This is the regression that shipped in 0.3.0: mobile.css regrids the shell
  // through `.dshm-frame`, but nothing added the class, so phones kept the
  // desktop grid and squeezed the conversation into a strip.
  const css = await read('src/client/styles/mobile.css')
  const sources = [
    await read('src/client/app.js'),
    await read('src/client/mobile/chrome.js'),
    await read('src/client/mobile/mode.js'),
    await read('src/client/mobile/nav.js'),
  ].join('\n')

  const declared = new Set()
  for (const match of css.matchAll(/\.(dshm-[a-z-]+)/g)) declared.add(match[1])
  assert.ok(declared.size >= 4, 'the stylesheet is expected to key off several state classes')

  const missing = [...declared].filter((name) => !sources.includes("'" + name + "'"))
  assert.deepEqual(missing, [], 'these classes are styled but never set: ' + missing.join(', '))
})

test('the bottom bar finds a glyph for every item it renders', async () => {
  // A missing glyph reaches React as `undefined` and the whole slot entry is
  // dropped with error #130 — the bar silently disappears.
  const nav = await read('src/client/mobile/nav.js')
  const icons = await read('src/client/panel/icons.js')
  const ids = [...nav.matchAll(/\{ id: '([a-z]+)', label: t\('mobile[A-Z][a-z]+'\), icon: glyphs\.([a-zA-Z]+) \}/g)]
  assert.ok(ids.length >= 4, 'the bar declares its four surfaces')
  for (const [, id, glyph] of ids) {
    assert.equal(glyph, id, 'item "' + id + '" must look up glyph "' + id + '"')
    assert.ok(
      new RegExp('(^|\\s)' + glyph + '\\s*:').test(icons) || new RegExp('function ' + glyph + '\\b').test(icons),
      'icons.js must export "' + glyph + '" for the bar',
    )
  }
})

test('the anchor table covers every selector the mobile layer needs', () => {
  const ids = new Set(ANCHORS.map((anchor) => anchor.id))
  for (const required of ['shellRoot', 'rightPanel', 'composerInput', 'sessionRow', 'filesPath']) {
    assert.ok(ids.has(required), 'anchor "' + required + '" must be declared')
  }
})

/** Runtime JS/MJS files, excluding tests, docs, and build output. */
async function listRuntimeFiles() {
  const out = []
  async function walk(directory, prefix) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'test' || entry.name === 'docs' || entry.name === 'bench') continue
      const rel = prefix === '' ? entry.name : prefix + '/' + entry.name
      const full = join(directory, entry.name)
      if (entry.isDirectory()) {
        await walk(full, rel)
        continue
      }
      if (!/\.(js|mjs)$/.test(entry.name)) continue
      if (rel === 'client.js' || rel === 'build.mjs') continue
      out.push(rel)
    }
  }
  await walk(join(root, '..'), '')
  return out.sort()
}
