import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadManifest, mediaFiles, tasksFor } from '../src/session.ts'
import { manifest, sessionDir } from './fixture.ts'

describe('blinding', () => {
  it('never exposes systems or file names to the rater', () => {
    const text = JSON.stringify(tasksFor(manifest, 'rater-1'))
    for (const item of manifest.items) {
      expect(text).not.toContain(item.system.split(':')[0])
      expect(text).not.toContain(item.file)
    }
  })

  it('rates every item, then compares every pair, in a stable per-rater order', () => {
    const tasks = tasksFor(manifest, 'rater-1')
    expect(tasks.map((t) => t.type)).toEqual(['rate', 'rate', 'rate', 'compare'])
    expect(new Set(tasks.filter((t) => t.type === 'rate').map((t) => t.id))).toEqual(
      new Set(manifest.items.map((i) => i.item)),
    )
    expect(tasksFor(manifest, 'rater-1')).toEqual(tasks)
    const orders = new Set(
      Array.from({ length: 12 }, (_, i) =>
        tasksFor(manifest, `rater-${i}`)
          .map((t) => t.id)
          .join(),
      ),
    )
    expect(orders.size).toBeGreaterThan(1)
  })

  it('shuffles which item is version A per rater', () => {
    const sides = new Set(
      Array.from({ length: 16 }, (_, i) => {
        const compare = tasksFor(manifest, `r${i}`).find((t) => t.type === 'compare')
        return compare?.type === 'compare' ? compare.a : ''
      }),
    )
    expect(sides).toEqual(new Set(['item0000000001', 'item0000000002']))
  })

  it('loads a session and maps only its own tokens to media files', () => {
    const loaded = loadManifest(sessionDir())
    expect(loaded).toEqual(manifest)
    const media = mediaFiles(loaded)
    expect(media.get('item0000000002')).toBe('song-a.6s.m4a')
    expect(media.get('mixbbbbbbbbbbbb')).toBe('song-b.mixture.m4a')
    expect(media.size).toBe(5)
  })

  it('rejects files outside the media directory', () => {
    const bad = { ...manifest, items: [{ ...manifest.items[0], file: '../secret.m4a' }] }
    expect(() => loadManifestFrom(bad)).toThrow()
  })
})

function loadManifestFrom(value: unknown) {
  return loadManifest(sessionDirWith(value))
}

function sessionDirWith(value: unknown): string {
  const dir = sessionDir()
  writeFileSync(join(dir, 'session.json'), JSON.stringify(value))
  return dir
}
