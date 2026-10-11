// Verifies that the packaged Qollab build (dist-qollab/) is the SAME app as
// `npm run dev`: same structure, same computed styles, same behavior.
// Usage: npm run build:qollab && npm run verify:qollab
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { chromium } from 'playwright'

const DEV_URL = 'http://localhost:5199'
const DIST_URL = 'http://localhost:5198'
const DIST_DIR = 'dist-qollab'
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }

const checks = []
let failures = 0
const check = (label, ok, detail = '') => {
  checks.push({ label, ok, detail })
  if (!ok) failures += 1
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`)
}

// --- tiny server that mimics Qollab's runtime: index.html is body content
// only, so we wrap it in a page that loads main.css + main.js exactly as the
// runtime does (top-level files, loaded automatically by name) ---
const distServer = createServer(async (req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0])
  const path = join(DIST_DIR, urlPath === '/' ? 'index.html' : urlPath)
  try {
    const body = await readFile(path)
    if (extname(path) === '.html') {
      const page = `<!doctype html><html><head><meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Araqnea</title><link rel="stylesheet" href="/main.css"></head>
<body>${body}<script type="module" src="/main.js"></script></body></html>`
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end(page)
      return
    }
    res.writeHead(200, { 'content-type': MIME[extname(path)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404).end('not found')
  }
})
await new Promise((resolve) => distServer.listen(5198, resolve))

// --- dev server (npm run dev) ---
const dev = spawn('npx', ['vite', '--port', '5199', '--strictPort'], { stdio: 'ignore' })
const waitUp = async (url) => {
  for (let i = 0; i < 60; i += 1) {
    try {
      if ((await fetch(url)).ok) return
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`${url} did not start`)
}
await waitUp(DEV_URL)

// --- collect a fingerprint of the app in a fresh browser context ---
const collect = async (browser, url) => {
  const context = await browser.newContext()
  // Skip the guided tour so it cannot intercept clicks (same for both apps).
  await context.addInitScript(() => window.localStorage.setItem('araqnea.tour.completed', 'true'))
  const page = await context.newPage()
  const consoleErrors = []
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })
  page.on('pageerror', (err) => consoleErrors.push(String(err)))
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForSelector('main.app-shell')

  const fingerprint = await page.evaluate(() => {
    const css = (sel, prop) => {
      const el = document.querySelector(sel)
      return el ? getComputedStyle(el)[prop] : null
    }
    return {
      title: document.title,
      brand: document.querySelector('a.brand')?.textContent?.trim(),
      status: document.querySelector('.header-status')?.textContent?.trim(),
      workspace: !!document.querySelector('.workspace'),
      presetOptions: [...document.querySelectorAll('.preset-toolbar select option')].map((o) => o.value),
      bodyBg: css('body', 'backgroundColor'),
      bodyFont: css('body', 'fontFamily'),
      brandColor: css('a.brand', 'color'),
      shellBg: css('main.app-shell', 'backgroundColor'),
      wireLabelFont: css('.wire-label', 'fontFamily'),
      stylesheetCount: document.styleSheets.length,
      scriptCount: document.scripts.length,
    }
  })

  // Functional check: load the first preset, open the gates view, count rendered rows.
  const firstPreset = fingerprint.presetOptions.find((v) => v)
  let interaction = null
  if (firstPreset) {
    await page.selectOption('.preset-toolbar select', firstPreset)
    await page.getByRole('button', { name: 'Load preset' }).click()
    await page.getByRole('tab', { name: /Circuit gates/ }).click()
    await page.waitForSelector('.circuit-row')
    interaction = await page.evaluate(() => ({
      rows: document.querySelectorAll('.circuit-row').length,
      wireLabels: [...document.querySelectorAll('.wire-label')].map((el) => el.textContent),
      titleValue: document.querySelector('.title-input')?.value,
    }))
  }
  await context.close()
  return { ...fingerprint, consoleErrors, interaction }
}

const browser = await chromium.launch()
try {
  console.log('\nFingerprinting dev server (npm run dev)…')
  const devApp = await collect(browser, DEV_URL)
  console.log('Fingerprinting packaged build (dist-qollab)…')
  const distApp = await collect(browser, DIST_URL)

  console.log('\nParity results:')
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  check('page title matches', devApp.title === distApp.title, `${devApp.title} vs ${distApp.title}`)
  check('brand header matches', devApp.brand === distApp.brand, devApp.brand)
  check('live-sync status matches', devApp.status === distApp.status, devApp.status)
  check('workspace layout present in both', devApp.workspace && distApp.workspace)
  check('preset list identical', same(devApp.presetOptions, distApp.presetOptions), `${distApp.presetOptions.length} presets`)
  check('body background identical', devApp.bodyBg === distApp.bodyBg, distApp.bodyBg)
  check('body font identical', devApp.bodyFont === distApp.bodyFont)
  check('brand color identical', devApp.brandColor === distApp.brandColor, distApp.brandColor)
  check('app-shell background identical', devApp.shellBg === distApp.shellBg, distApp.shellBg)
  check('wire-label font identical', devApp.wireLabelFont === distApp.wireLabelFont)
  check('no console errors in dev app', devApp.consoleErrors.length === 0, devApp.consoleErrors[0])
  check('no console errors in packaged app', distApp.consoleErrors.length === 0, distApp.consoleErrors[0])
  check('stylesheets loaded in packaged app', distApp.stylesheetCount > 0, `${distApp.stylesheetCount} sheets`)
  check('load-preset interaction identical', same(devApp.interaction, distApp.interaction),
    same(devApp.interaction, distApp.interaction) ? `${distApp.interaction?.rows} rows on ${distApp.interaction?.wireLabels?.length} wires` : 'MISMATCH')
} finally {
  await browser.close()
  dev.kill()
  distServer.close()
}

if (failures) {
  console.error(`\n✗ ${failures} parity check(s) failed — the packaged app differs from dev.\n`)
  process.exit(1)
}
console.log('\n✓ Full parity: the Qollab package is the same app, with the same styles and behavior.\n')
