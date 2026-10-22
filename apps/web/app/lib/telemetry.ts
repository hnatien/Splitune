import type { BrowserFamily, DeviceClass } from '@splitune/contracts'
import type { z } from 'zod'
import { analytics } from './analytics'
import { isInAppBrowser, probeCapabilities } from './capabilities'
import { displayPreferences, useDisplay } from './display-store'
import { connectTracker, type QueuedEvent } from './track'

// The product-event sender (16 §2), started after the first render (lib/after-render.ts, outside
// the route budgets): sends what lib/track.ts queues, adding the device context, and records the
// device's own events — the capability probe once per browser session, the in-app-browser banner,
// and display choices after the learner changes one. The browser family is for the platform
// dashboard only — read from the user agent for reporting, never to change behaviour (24: feature
// detection decides everything).

const PROBED_KEY = 'splitune.probed'
const DISPLAY_SETTLE_MS = 2_000

export function browserFamily(userAgent: string): z.infer<typeof BrowserFamily> {
  if (/Firefox\//.test(userAgent)) return 'firefox'
  if (/Chrom(e|ium)\/|Edg\//.test(userAgent)) return 'chromium'
  if (/AppleWebKit\//.test(userAgent)) return 'webkit'
  return 'other'
}

export function deviceClass(query: (q: string) => boolean): z.infer<typeof DeviceClass> {
  if (!query('(pointer: coarse)')) return 'desktop'
  return query('(max-width: 640px), (max-height: 640px)') ? 'phone' : 'tablet'
}

export function inAppApp(userAgent: string): 'instagram' | 'facebook' | 'tiktok' | 'other' {
  if (/Instagram/i.test(userAgent)) return 'instagram'
  if (/FBAN|FBAV|FB_IAB/.test(userAgent)) return 'facebook'
  if (/TikTok|musical_ly|Bytedance/i.test(userAgent)) return 'tiktok'
  return 'other'
}

function device() {
  return {
    browser: browserFamily(navigator.userAgent),
    device_class: deviceClass((q) => window.matchMedia(q).matches),
  }
}

// The device props an event declares, filled in here (track.ts leaves them out).
export function withDevice(event: QueuedEvent): QueuedEvent {
  switch (event.name) {
    case 'audio_underrun':
      return { ...event, props: { ...event.props, ...device() } }
    case 'in_app_browser_banner_viewed':
    case 'in_app_browser_opened_external':
      return { ...event, props: { ...event.props, app: inAppApp(navigator.userAgent) } }
    default:
      return event
  }
}

const send = (event: QueuedEvent) => {
  const { name, props } = withDevice(event)
  analytics.track(name, props as never)
}

function probeOnce(): void {
  try {
    if (sessionStorage.getItem(PROBED_KEY)) return
    sessionStorage.setItem(PROBED_KEY, '1')
  } catch {
    // Storage blocked: probed once per page instead.
  }
  const caps = probeCapabilities()
  analytics.track('capability_probe', {
    ...device(),
    audio_worklet: caps.audioWorklet,
    wasm_simd: caps.wasmSimd,
    webcodecs: caps.webCodecsAudio,
    opus_ok: document.createElement('audio').canPlayType('audio/webm; codecs="opus"') !== '',
    // Known only from a running AudioContext, which needs a gesture; not probed here.
    output_latency_ms: null,
    webgpu: 'gpu' in navigator,
    wake_lock: caps.wakeLock,
    midi: caps.webMidi,
  })
}

let timer: ReturnType<typeof setTimeout> | undefined

// One event per burst of changes (a slider drags through many values).
function displayChanged(): void {
  clearTimeout(timer)
  timer = setTimeout(() => {
    const prefs = displayPreferences(useDisplay.getState())
    analytics.track('display_settings_changed', {
      appearance: prefs.appearance,
      score_surface: prefs.score,
      distance: prefs.distance ?? 'auto',
      calibration_pct: Math.round(prefs.calibration * 100),
      hyperlegible: prefs.readingFont === 'hyperlegible',
      reduced_motion: prefs.motion,
      contrast: prefs.contrast,
    })
  }, DISPLAY_SETTLE_MS)
}

export function startDeviceTelemetry(): void {
  connectTracker(send)
  probeOnce()
  if (isInAppBrowser(navigator.userAgent)) send({ name: 'in_app_browser_banner_viewed', props: {} })
  useDisplay.subscribe(displayChanged)
}
