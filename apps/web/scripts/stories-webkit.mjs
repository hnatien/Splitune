// The WebKit story project needs a WebKit that can play: the practice screen's stories wait for
// the audio engine, and Playwright's WebKit build for Windows has no Web Audio, where each of them
// ran out its 15 s timeout (237 stories, an hour). The default export is that project's global
// setup (vitest.config.ts): it stops a run that could only time out and says how to run it.
import { webkit } from 'playwright'

/** Whether this machine's Playwright WebKit has Web Audio: asked of the browser, not the platform. */
export async function localWebKitPlays() {
  const browser = await webkit.launch()
  try {
    const page = await browser.newPage()
    return await page.evaluate(() => 'AudioContext' in globalThis)
  } finally {
    await browser.close()
  }
}

export default async function setup() {
  if (process.env.PW_WEBKIT_WS_ENDPOINT || (await localWebKitPlays())) return
  throw new Error(
    "This machine's Playwright WebKit has no Web Audio, so the practice stories cannot run in it. " +
      'Run them through `pnpm --filter @splitune/web test:stories` (add `--project=storybook-webkit` ' +
      'and story files as needed): it starts WebKit in the Linux Playwright image, which needs Docker. ' +
      'Or point PW_WEBKIT_WS_ENDPOINT at a Playwright server that is already running.',
  )
}
