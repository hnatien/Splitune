import { execFile } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { expect, test } from '@playwright/test'

// The floor check (24 §6, monthly; `pnpm --filter @splitune/web e2e:floor`): the oldest engines
// Playwright has shipped near the support floor, each in its own image with its own
// playwright-core, against this run's server — Chromium 111 and WebKit 16.4 (Playwright 1.31),
// Firefox 128 (1.46). Playwright's WebKit is not Safari: Safari 16.4 itself needs a device.
// Docker pulls ~2 GB of images the first time, so it runs only with E2E_FLOOR=1.

const FLOOR = join(dirname(fileURLToPath(import.meta.url)), 'floor')
const ENGINES = [
  { engine: 'chromium', image: 'mcr.microsoft.com/playwright:v1.31.0-focal', core: '1.31.0' },
  { engine: 'webkit', image: 'mcr.microsoft.com/playwright:v1.31.0-focal', core: '1.31.0' },
  { engine: 'firefox', image: 'mcr.microsoft.com/playwright:v1.46.0-jammy', core: '1.46.0' },
] as const

// Firefox needs an audio output device for its AudioContext: a PulseAudio null sink.
const PULSE =
  'apt-get update -qq >/dev/null && apt-get install -y -qq --no-install-recommends pulseaudio >/dev/null && pulseaudio --start --exit-idle-time=-1 && pactl load-module module-null-sink sink_name=null >/dev/null && pactl set-default-sink null && '

// FLOOR_ENGINE=webkit runs one engine; FLOOR_DEBUG=1 adds the page's console and requests.
const { E2E_FLOOR, FLOOR_ENGINE: only, FLOOR_DEBUG = '' } = process.env
for (const { engine, image, core } of ENGINES.filter((e) => !only || e.engine === only)) {
  test(`floor: ${engine} (${image.split(':')[1]})`, async () => {
    const info = test.info()
    test.skip(E2E_FLOOR !== '1', 'E2E_FLOOR=1 runs the floor check')
    test.skip(info.project.name !== 'chromium', 'one run of the floor check per suite')
    test.setTimeout(600_000)
    const script = `${engine === 'firefox' ? PULSE : ''}cd /tmp && npm install --silent --no-audit --no-fund playwright-core@${core} >/dev/null && NODE_PATH=/tmp/node_modules node /floor/check.cjs ${engine}`
    const { stdout } = await promisify(execFile)(
      'docker',
      [
        'run',
        '--rm',
        '--platform',
        'linux/amd64',
        '--add-host=host.docker.internal:host-gateway',
        '-v',
        `${FLOOR}:/floor:ro`,
        '-e',
        `FLOOR_DEBUG=${FLOOR_DEBUG}`,
        image,
        'sh',
        '-c',
        script,
      ],
      { timeout: 540_000, maxBuffer: 4 * 1024 * 1024 },
    )
    const result = JSON.parse(stdout.trim().split('\n').at(-1) ?? '{}') as {
      version: string
      appearances: Record<string, { attribute: string; background: string; color: string }>
      capabilities: { aac: boolean; audioWorklet: boolean; wasmSimd: boolean }
      audioError?: boolean
      unsupportedPage?: boolean
      loop?: string
      failure?: string
      errors: string[]
    }
    info.annotations.push({ type: `floor ${engine}`, description: JSON.stringify(result) })
    // The result is the report (24 §6): kept in the run's log.
    console.log(`[floor ${engine} ${result.version}] ${JSON.stringify(result)}`)
    // Playwright's Chromium 111 has no AAC decoder (open-source build); branded Chrome 111 does.
    // There the practice screen must report the audio problem instead of playing.
    const aac = result.capabilities.aac
    if (aac) expect(result.failure).toBeUndefined()
    else expect(result).toMatchObject({ audioError: true, failure: 'audio could not load' })
    for (const [appearance, colours] of Object.entries(result.appearances)) {
      expect(colours.attribute, appearance).toBe(appearance)
      expect(colours.background, appearance).not.toMatch(/^(rgba\(0, 0, 0, 0\)|transparent)$/)
      expect(colours.color, appearance).not.toBe(colours.background)
    }
    expect(Object.keys(result.appearances)).toEqual(['light', 'dark', 'stage'])
    expect(result.capabilities).toMatchObject({ audioWorklet: true, wasmSimd: true })
    expect(result.unsupportedPage).toBe(true)
    if (aac) expect(result.loop).toMatch(/pass 1/)
    expect(result.errors).toEqual([])
  })
}
