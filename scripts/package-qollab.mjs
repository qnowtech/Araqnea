// Packages dist-qollab/ into araqnea-qollab.zip and asserts Qollab's limits:
//   - at most 100 files per project
//   - at most 2 MB per file
// Fails the build (exit 1) if either limit is exceeded.
import { execFileSync } from 'node:child_process'
import { readdirSync, rmSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const DIST = 'dist-qollab'
const ZIP = 'araqnea-qollab.zip'
const MAX_FILES = 100
const MAX_BYTES = 2 * 1024 * 1024 // 2 MB

// Walk recursively — the Qollab layout keeps assets in a static/ subfolder.
const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [relative(DIST, path)]
  })
const files = walk(DIST)

console.log(`\nQollab package contents (${files.length}/${MAX_FILES} files):`)
let failed = false
for (const name of files) {
  const size = statSync(join(DIST, name)).size
  const ok = size <= MAX_BYTES
  if (!ok) failed = true
  console.log(`  ${ok ? '✓' : '✗'} ${name.padEnd(20)} ${(size / 1024).toFixed(1).padStart(8)} KB ${ok ? '' : '— OVER 2 MB LIMIT'}`)
}
if (files.length > MAX_FILES) {
  console.error(`✗ ${files.length} files exceed the ${MAX_FILES}-file limit`)
  failed = true
}
if (failed) {
  console.error('\nPackage violates Qollab limits — not zipping.')
  process.exit(1)
}

rmSync(ZIP, { force: true })
execFileSync('zip', ['-qr', `../${ZIP}`, '.'], { cwd: DIST })
const zipSize = statSync(ZIP).size
console.log(`\n✓ ${ZIP} ready (${(zipSize / 1024).toFixed(1)} KB) — upload this file to Qollab.\n`)
