#!/usr/bin/env node
/**
 * Produce the two distributable artifacts in `dist/`:
 *
 *   dsh-remote-<version>.tgz   the DSH plugin bundle (npm pack)
 *   dsh-remote-android.apk     the Android WebView shell (a debug build)
 *
 * Build steps that need a toolchain this repo cannot assume (esbuild's service
 * binary, the Android SDK) are skipped with a warning rather than failing the
 * whole release: reusing an already-built artifact is normal here.
 *
 * Usage:
 *   node scripts/package.mjs            both artifacts
 *   node scripts/package.mjs --plugin   plugin only
 *   node scripts/package.mjs --apk      Android only
 */
import { execSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const dist = join(root, 'dist')
const manifest = JSON.parse(execSync('node -p "JSON.stringify(require(\'./package.json\'))"', { cwd: root, encoding: 'utf8' }))
const version = manifest.version

const onlyPlugin = process.argv.includes('--plugin')
const onlyApk = process.argv.includes('--apk')
const wantPlugin = onlyPlugin || (!onlyPlugin && !onlyApk)
const wantApk = onlyApk || (!onlyPlugin && !onlyApk)

mkdirSync(dist, { recursive: true })

/** Report a produced file with its size. */
function report(path, label) {
  const { size } = statSync(path)
  const mb = (size / (1024 * 1024)).toFixed(2)
  console.log(`  ${label}: ${path} (${mb} MB)`)
}

function packagePlugin() {
  console.log('plugin bundle')
  const tarball = `dsh-remote-${version}.tgz`
  execSync(`npm pack --pack-destination "${dist}"`, { cwd: root, stdio: 'inherit' })
  const produced = join(dist, tarball)
  if (!existsSync(produced)) throw new Error('npm pack produced no tarball')
  report(produced, tarball)
}

function packageApk() {
  console.log('android apk')
  const built = join(root, 'android/app/build/outputs/apk/debug/app-debug.apk')
  if (!existsSync(built)) {
    console.warn('  skipped: no debug APK; run "cd android && ./gradlew assembleDebug" first')
    return
  }
  const target = join(dist, 'dsh-remote-android.apk')
  copyFileSync(built, target)
  report(target, 'dsh-remote-android.apk')
}

for (const dir of readdirSync(dist)) {
  if (dir.endsWith('.tgz') || dir.endsWith('.apk')) rmSync(join(dist, dir), { force: true })
}

if (wantPlugin) packagePlugin()
if (wantApk) packageApk()
console.log('done')
