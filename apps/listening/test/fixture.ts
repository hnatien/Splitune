import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Manifest } from '../src/session.ts'

export const manifest: Manifest = {
  id: 'p1-test',
  question: 'Could I practise with this?',
  clips: [
    {
      clip: 'song-a',
      target: 'guitar',
      mixture: { token: 'mixaaaaaaaaaaaa', file: 'song-a.mixture.m4a' },
    },
    {
      clip: 'song-b',
      target: 'vocals',
      mixture: { token: 'mixbbbbbbbbbbbb', file: 'song-b.mixture.m4a' },
    },
  ],
  items: [
    {
      item: 'item0000000001',
      clip: 'song-a',
      kind: 'isolated',
      system: 'bs_roformer_sw',
      file: 'song-a.sw.m4a',
    },
    {
      item: 'item0000000002',
      clip: 'song-a',
      kind: 'isolated',
      system: 'htdemucs_6s',
      file: 'song-a.6s.m4a',
    },
    {
      item: 'item0000000003',
      clip: 'song-b',
      kind: 'mix_minus',
      system: 'mel_roformer_kim_vocals:complement',
      file: 'song-b.kim.m4a',
    },
  ],
  pairs: [{ pair: 'pair0000000001', clip: 'song-a', a: 'item0000000001', b: 'item0000000002' }],
}

export function sessionDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'listening-'))
  mkdirSync(join(dir, 'media'))
  writeFileSync(join(dir, 'session.json'), JSON.stringify(manifest))
  for (const file of [
    'song-a.sw.m4a',
    'song-a.6s.m4a',
    'song-b.kim.m4a',
    'song-a.mixture.m4a',
    'song-b.mixture.m4a',
  ]) {
    writeFileSync(join(dir, 'media', file), `audio:${file}`)
  }
  return dir
}
