// Floor check (24 §6), run by e2e/floor.spec.ts inside an old Playwright image with that image's
// playwright-core (NODE_PATH): Chromium 111 and WebKit 16.4 (v1.31), Firefox 128 (v1.46). The
// app is the E2E server on the host; ports 3000 and 8333 are forwarded so the page stays on
// http://localhost (a secure context: AudioWorklet needs one). Prints one JSON line.
const net = require('node:net')
const playwright = require('playwright-core')

const engine = process.argv[2]
const HOST = 'host.docker.internal'
const APP = 'http://localhost:3000'

for (const port of [3000, 8333]) {
  net
    .createServer((client) => {
      const upstream = net.connect(port, HOST)
      client.pipe(upstream).pipe(client)
      client.on('error', () => upstream.destroy())
      upstream.on('error', () => client.destroy())
    })
    .listen(port, '127.0.0.1')
}

async function until(check, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    if (await check()) return
    if (Date.now() > deadline) throw new Error(`timed out after ${timeoutMs} ms`)
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
}

async function main() {
  const browser = await playwright[engine].launch()
  const result = { engine, version: browser.version(), appearances: {}, errors: [] }
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  page.on('pageerror', (error) => result.errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') result.errors.push(`console: ${message.text()}`)
    if (process.env.FLOOR_DEBUG)
      result.log = [...(result.log ?? []), `${message.type()}: ${message.text()}`]
  })
  page.on('worker', (worker) => {
    if (!process.env.FLOOR_DEBUG) return
    result.log = [...(result.log ?? []), `worker ${worker.url().split('/').pop()}`]
    worker.on('close', () => result.log.push(`worker closed ${worker.url().split('/').pop()}`))
  })
  page.on('requestfailed', (request) => {
    if (process.env.FLOOR_DEBUG)
      result.log = [
        ...(result.log ?? []),
        `failed ${request.url()} ${request.failure()?.errorText}`,
      ]
  })
  try {
    // Tokens in every appearance: the page has real colours, text differs from its background.
    for (const appearance of ['light', 'dark', 'stage']) {
      await page.goto(`${APP}/`)
      await page.evaluate(
        (a) => localStorage.setItem('splitune.display', JSON.stringify({ appearance: a })),
        appearance,
      )
      // Idle before moving on: a navigation cancelling lazy chunks is reported as an error.
      await page.reload({ waitUntil: 'networkidle' })
      await page.getByRole('heading', { level: 1 }).first().waitFor()
      result.appearances[appearance] = await page.evaluate(() => {
        const body = getComputedStyle(document.body)
        const primary = document.querySelector('a[href="/start"], [data-slot=button]')
        return {
          attribute: document.documentElement.getAttribute('data-appearance'),
          background: body.backgroundColor,
          color: body.color,
          primary: primary ? getComputedStyle(primary).backgroundColor : null,
        }
      })
    }
    await page.evaluate(() => localStorage.removeItem('splitune.display'))
    result.capabilities = await page.evaluate(() => ({
      // Playwright's Chromium builds before 1.49 have no proprietary codecs (the stems are AAC);
      // every branded Chrome, Safari and Firefox does.
      aac: document.createElement('audio').canPlayType('audio/mp4; codecs="mp4a.40.2"') !== '',
      audioWorklet: typeof AudioWorkletNode === 'function',
      wasmSimd: WebAssembly.validate(
        new Uint8Array([
          0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0,
          253, 15, 253, 98, 11,
        ]),
      ),
    }))
    await page.goto(`${APP}/unsupported`, { waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: "Splitune can't run in this browser" }).waitFor()
    result.unsupportedPage = true
    // Onboarding to a slowed loop of the example song: AudioWorklet, WASM SIMD, decode, alphaTab.
    await page.goto(`${APP}/start`)
    await page.getByRole('button', { name: 'Guitar', exact: true }).click()
    await page.getByRole('button', { name: 'Just started' }).click()
    await page.getByRole('button', { name: 'Skip' }).click()
    const play = page.getByRole('button', { name: 'Play your part' })
    const audioError = page.getByText("We couldn't load the audio for this song.")
    await until(
      async () => (await play.isEnabled().catch(() => false)) || (await audioError.isVisible()),
      90_000,
    )
    if (await audioError.isVisible()) {
      // Without an AAC decoder the stems can't play: the screen says so (no hang, no crash).
      result.audioError = true
      throw new Error('audio could not load')
    }
    await play.click()
    const badge = page.getByRole('button', { name: /^Loop · bars \d+–\d+/ })
    await until(
      async () => /pass 1/.test((await badge.textContent().catch(() => '')) ?? ''),
      60_000,
    )
    result.loop = (await badge.textContent()).trim()
  } catch (error) {
    result.failure = String(error?.message ?? error).split('\n')[0]
    result.url = page.url()
    result.text = (await page.innerText('body').catch(() => '')).replace(/\s+/g, ' ').slice(0, 600)
  }
  await browser.close()
  process.stdout.write(`${JSON.stringify(result)}\n`)
  process.exit(0)
}

main()
