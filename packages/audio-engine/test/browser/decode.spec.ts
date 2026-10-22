// Stem alignment (docs/implementation/18-testing-strategy.md §2): AAC and Opus encodes of a known
// PCM decode, through both decode paths, to exactly the timeline length at 48 kHz with zero
// offset. Fixtures are encoded here with the same settings as the separation stage
// (services/ml/packages/stage_separation/src/stage_separation/encode.py).
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { chord } from '../signals.ts'

const SOURCE_RATE = 44100
const SECONDS = 3
const dir = mkdtempSync(join(tmpdir(), 'splitune-engine-decode-'))
const has = (command: string) => {
  try {
    execFileSync('which', [command], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function writeFixtures() {
  const pcm = chord(SOURCE_RATE, SECONDS, 0.5)
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + pcm.byteLength, 4)
  header.write('WAVEfmt ', 8)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(2, 22)
  header.writeUInt32LE(SOURCE_RATE, 24)
  header.writeUInt32LE(SOURCE_RATE * 4, 28)
  header.writeUInt16LE(4, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(pcm.byteLength, 40)
  const wav = join(dir, 'source.wav')
  writeFileSync(wav, Buffer.concat([header, Buffer.from(pcm.buffer)]))
  writeFileSync(
    join(dir, 'source.f32'),
    Buffer.from(Float32Array.from(pcm, (v) => v / 32768).buffer),
  )
  const ffmpeg = (args: string[]) =>
    execFileSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-i', wav, ...args])
  ffmpeg([
    '-c:a',
    'aac',
    '-b:a',
    '160k',
    '-movie_timescale',
    String(SOURCE_RATE),
    join(dir, 'ffmpeg.m4a'),
  ])
  ffmpeg(['-c:a', 'libopus', '-b:a', '96k', '-f', 'webm', join(dir, 'opus.webm')])
  const files = ['ffmpeg.m4a', 'opus.webm']
  if (has('afconvert')) {
    execFileSync('afconvert', [
      '-f',
      'm4af',
      '-d',
      'aac',
      '-b',
      '160000',
      '-s',
      '0',
      wav,
      join(dir, 'audiotoolbox.m4a'),
    ])
    files.push('audiotoolbox.m4a')
  }
  return files
}

const files = writeFixtures()

test.beforeEach(async ({ page }) => {
  await page.route('**/fixtures/*', (route) =>
    route.fulfill({
      body: readFileSync(join(dir, new URL(route.request().url()).pathname.split('/').pop() ?? '')),
    }),
  )
  await page.goto('/')
  await page.waitForFunction(() => 'harness' in window)
})

for (const file of files) {
  for (const path of ['webcodecs', 'decodeAudioData'] as const) {
    test(`${file} via ${path} decodes to the timeline at offset 0`, async ({
      page,
      browserName,
    }) => {
      test.fail(
        file === 'opus.webm' && path === 'decodeAudioData' && browserName === 'chromium',
        "Chromium's decodeAudioData starts Opus 24 frames early: why stems default to AAC",
      )
      const result = await page.evaluate((check) => window.harness.decode(check), {
        file: `/fixtures/${file}`,
        reference: '/fixtures/source.f32',
        durationSeconds: SECONDS,
        path,
      })
      test.skip('skipped' in result, 'skipped' in result ? result.skipped : '')
      expect(result).toEqual({
        frames: SECONDS * 48000,
        path,
        lag: 0,
        peaks: Math.ceil((SECONDS * 48000) / 512) * 2,
      })
    })
  }
}
