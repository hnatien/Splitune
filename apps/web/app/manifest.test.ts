import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BACKGROUND_HEX } from '@splitune/ui-tokens'
import { describe, expect, it } from 'vitest'

// The web app manifest (10 §6): installable (name, standalone, 192 and 512 px icons, a maskable
// one) and coloured from the tokens, with every icon it names on disk.
const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url))
const manifest = JSON.parse(readFileSync(join(PUBLIC, 'manifest.webmanifest'), 'utf8')) as {
  name: string
  start_url: string
  display: string
  background_color: string
  theme_color: string
  icons: { src: string; sizes: string; type: string; purpose: string }[]
}

describe('web app manifest', () => {
  it('has what installation needs', () => {
    expect(manifest).toMatchObject({
      name: 'Splitune',
      start_url: '/library',
      display: 'standalone',
    })
    const png = manifest.icons.filter((i) => i.type === 'image/png' && i.purpose === 'any')
    expect(png.map((i) => i.sizes).sort()).toEqual(['192x192', '512x512'])
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true)
  })

  it('takes its colours from the Light background token', () => {
    expect(manifest.background_color).toBe(BACKGROUND_HEX.light)
    expect(manifest.theme_color).toBe(BACKGROUND_HEX.light)
  })

  it('names only icons that exist', () => {
    for (const icon of manifest.icons) {
      expect(existsSync(join(PUBLIC, icon.src.slice(1))), icon.src).toBe(true)
    }
    expect(existsSync(join(PUBLIC, 'icons/apple-touch-icon.png'))).toBe(true)
  })
})
