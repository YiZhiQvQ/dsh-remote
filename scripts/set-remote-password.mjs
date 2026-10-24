import { mkdirSync, writeFileSync } from 'node:fs'
import { randomBytes, scryptSync } from 'node:crypto'
import { homedir } from 'node:os'
import { join } from 'node:path'

const username = (process.argv[2] || 'admin').trim() || 'admin'
let password = ''
process.stdin.setEncoding('utf8')
for await (const chunk of process.stdin) password += chunk
password = password.replace(/\r?\n$/, '')
if (password.length < 8) {
  console.error('password must be at least 8 characters')
  process.exit(1)
}

const salt = randomBytes(16).toString('hex')
const hash = scryptSync(password, Buffer.from(salt, 'hex'), 64).toString('hex')
const home = process.env.DSH_HOME || join(homedir(), '.dsh')
mkdirSync(home, { recursive: true })
const file = join(home, 'dsh-remote-auth.json')
writeFileSync(file, JSON.stringify({ username, salt, hash }, null, 2) + '\n', { mode: 0o600 })
console.log('saved username ' + username + ' to ' + file)
console.log('restart DSH to load the new password')
