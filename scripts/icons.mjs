// מייצר אייקוני PNG מ-public/icon.svg. הרצה: node scripts/icons.mjs
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'

const svg = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8')
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
const page = await browser.newPage()
for (const [name, size, pad] of [['icon-192.png', 192, 0], ['icon-512.png', 512, 0], ['icon-maskable-512.png', 512, 0.12]]) {
  await page.setViewportSize({ width: size, height: size })
  const inner = Math.round(size * (1 - 2 * pad))
  await page.setContent(`<html><body style="margin:0;background:#0e1116;display:grid;place-items:center;width:${size}px;height:${size}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</body></html>`)
  await page.screenshot({ path: `public/${name}` })
}
await browser.close()
