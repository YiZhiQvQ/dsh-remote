import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(fileURLToPath(import.meta.url))
const yaml = await readFile(join(root, '..', 'cordis.patch.yml'), 'utf8')

/** Pull the body of a `!!js` expression so it can be evaluated in isolation. */
function expressionAfter(label, endLabel) {
  const start = yaml.indexOf(label)
  assert.notEqual(start, -1, label + ' must exist')
  const from = yaml.indexOf('\n', start) + 1
  const end = yaml.indexOf(endLabel, from)
  assert.notEqual(end, -1, endLabel + ' must exist after ' + label)
  return yaml.slice(from, end)
}

test('patch text is clean UTF-8 with no mojibake', () => {
  assert.equal(yaml.includes('\uFFFD'), false, 'no replacement characters')
  assert.equal(/[鍦-閿]{2,}/.test(yaml), false, 'no GBK round-trip garbage')
  assert.match(yaml, /dsh-remote/)
})

test('the patch pins the desktop port and mounts the single-admin plugin', () => {
  assert.match(yaml, /id: webserver/)
  assert.match(yaml, /port: 52551/)
  assert.match(yaml, /id: web-runtime/)
  assert.match(yaml, /publicUrl: !!js/)
  assert.match(yaml, /id: dsh-remote/)
  assert.match(yaml, /name: dsh-remote/)
  assert.match(yaml, /listenPort: 3080/)
  assert.match(yaml, /dshPort: 52551/)
  assert.doesNotMatch(yaml, /multiAccount|workspaceRoot/)
})

test('the desktop window stays on the loopback DSH URL', () => {
  const expression = expressionAfter('publicUrl: !!js >-', '    surfaceContext:')
  const evaluate = new Function('ctx', 'return (' + expression + ')')
  const value = evaluate({ webStartup: { publicUrl: undefined, trustedHosts: [] } })
  assert.equal(value, 'http://127.0.0.1:52551/')
})

test('the Host/Origin fence is not widened for the LAN', () => {
  // The proxy rewrites Host and Origin to the loopback authority before
  // forwarding, so the fence never sees a LAN host. Adding LAN addresses here
  // would only weaken the DNS-rebinding defence on the local listener.
  assert.doesNotMatch(yaml, /^\s*trustedHosts:/m)
})

test('the patch leaves the directory picker alone', () => {
  // Changing this composition swaps the picker for every window on this machine,
  // including the local desktop one. A remote-access plugin has no business
  // altering how the operator adds a workspace locally, so the rule is that the
  // patch does not mention the picker at all.
  assert.doesNotMatch(yaml, /^\s*-?\s*id:\s*directory-picker/m, 'no directory-picker row may be targeted')
  assert.doesNotMatch(yaml, /disabled:\s*true/, 'no row may be disabled on the operator behalf')
  assert.doesNotMatch(yaml, /dsh-host-directory-picker-browse|dsh-client-ui-directory-picker-browse/, 'no picker backend may be inserted')
})
