import test from 'node:test'
import assert from 'node:assert/strict'
import { isPrivateIpLiteral, selectLanAddresses, splitAuthority, buildPublicUrl, PRIVATE_V4_SOURCE } from '../host/lan.js'

function iface(address, family = 'IPv4', internal = false) {
  return { address, family, internal, netmask: '255.255.255.0', mac: '00:00:00:00:00:00', cidr: address + '/24' }
}

test('only private, non-internal IPv4 addresses are advertised', () => {
  const rows = selectLanAddresses({
    'Wi-Fi': [iface('192.168.1.20'), iface('fe80::1', 'IPv6'), iface('127.0.0.1', 'IPv4', true)],
    Ethernet: [iface('10.1.2.3')],
    Public: [iface('203.0.113.9')],
    CGNAT: [iface('100.101.102.103')],
  })
  const addresses = rows.map((row) => row.address)
  assert.deepEqual(addresses.sort(), ['10.1.2.3', '100.101.102.103', '192.168.1.20'].sort())
})

test('physical interfaces sort ahead of overlays and virtual adapters', () => {
  const rows = selectLanAddresses({
    'vEthernet (WSL)': [iface('172.20.0.1')],
    Tailscale: [iface('100.64.1.2')],
    'Wi-Fi': [iface('192.168.0.9')],
  })
  assert.equal(rows[0].address, '192.168.0.9')
  assert.equal(rows[rows.length - 1].address, '172.20.0.1')
})

test('duplicate addresses collapse to one row', () => {
  const rows = selectLanAddresses({
    A: [iface('10.0.0.5')],
    B: [iface('10.0.0.5')],
  })
  assert.equal(rows.length, 1)
})

test('the private-range test matches the ranges the fence relies on', () => {
  for (const address of ['10.0.0.1', '172.16.0.1', '172.31.255.255', '192.168.1.1', '100.64.0.1', '100.127.255.255']) {
    assert.equal(isPrivateIpLiteral(address), true, address + ' must be accepted')
  }
  for (const address of ['8.8.8.8', '203.0.113.9', '172.15.0.1', '172.32.0.1', '100.63.0.1', '100.128.0.1', 'evil.example']) {
    assert.equal(isPrivateIpLiteral(address), false, address + ' must be refused')
  }
  assert.equal(isPrivateIpLiteral('127.0.0.1'), true)
  assert.equal(isPrivateIpLiteral('localhost'), true)
})

test('splitAuthority keeps IPv6 literals intact', () => {
  assert.deepEqual(splitAuthority('192.168.1.9:3080'), { hostname: '192.168.1.9', port: '3080' })
  assert.deepEqual(splitAuthority('192.168.1.9'), { hostname: '192.168.1.9', port: '' })
  assert.deepEqual(splitAuthority('[::1]:3080'), { hostname: '[::1]', port: '3080' })
  assert.deepEqual(splitAuthority(''), { hostname: '', port: '' })
})

test('buildPublicUrl names the preferred address', () => {
  assert.equal(buildPublicUrl([{ name: 'Wi-Fi', address: '192.168.1.5' }], 3080), 'http://192.168.1.5:3080/')
  assert.equal(buildPublicUrl([], 3080), undefined)
})

test('the exported pattern source is a usable regex', () => {
  const pattern = new RegExp(PRIVATE_V4_SOURCE)
  assert.ok(pattern.test('192.168.0.1'))
  assert.ok(!pattern.test('8.8.8.8'))
})
