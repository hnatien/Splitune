// pnpm --filter @splitune/web icons — renders the PNG sizes of the app icon (doc 26 §11, step 10a's
// SVGs) for the web app manifest and iOS's apple-touch-icon, which take no SVG. Run after changing
// an icon SVG and commit the PNGs with it.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ICONS = fileURLToPath(new URL('../public/icons/', import.meta.url))
const RENDERS = [
  { svg: 'icon.svg', png: 'icon-192.png', size: 192 },
  { svg: 'icon.svg', png: 'icon-512.png', size: 512 },
  { svg: 'icon-maskable.svg', png: 'icon-maskable-512.png', size: 512 },
  // iOS rounds the corners itself, so it gets the full-bleed (maskable) artwork.
  { svg: 'icon-maskable.svg', png: 'apple-touch-icon.png', size: 180 },
]

const browser = await chromium.launch()
try {
  for (const { svg, png, size } of RENDERS) {
    const page = await browser.newPage({ viewport: { width: size, height: size } })
    const markup = readFileSync(`${ICONS}${svg}`, 'utf8')
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${markup}`,
    )
    await page.locator('svg').screenshot({ path: `${ICONS}${png}`, omitBackground: true })
    await page.close()
    console.log(`${png} (${size}×${size})`)
  }
} finally {
  await browser.close()
}
