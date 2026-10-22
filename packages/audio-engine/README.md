# audio-engine

The practice audio engine (docs/implementation/11-audio-engine.md): an AudioWorklet (`SplituneProcessor`) running `dsp.wasm` from `@splitune/audio-dsp`, which mixes the stems, time-stretches and pitch-shifts the submix with one Signalsmith Stretch instance, loops seamlessly, synthesises count-in and metronome clicks and reports the heard position; a decode path that turns stem files into the engine's PCM; and the master clock every display follows.

All public times are **seconds on the decoded-PCM timeline**. The AudioContext runs at **48 kHz**; stems are decoded to that rate.

## Usage (step 12)

```ts
import { createEngine, decodeStem, dbToGain, loadDspModule } from '@splitune/audio-engine'

// Before any gesture: fetch and compile dsp.wasm once per page.
void loadDspModule()

// From the first user gesture (iOS unlocks audio only there): creates the 48 kHz AudioContext.
const engine = await createEngine()

// Stems from stems.json: decode each file at the context rate, trimmed to the timeline length.
const decoded = await Promise.all(
  stemsJson.stems.map(async (stem) => {
    const bytes = await (await fetch(urlFor(stem))).arrayBuffer()
    return decodeStem(bytes, { sampleRate: engine.sampleRate, durationSeconds: stemsJson.duration_s })
  }),
)
// decoded[i].peaks: min/max pairs per 512 frames for the timeline (cache them in IndexedDB).
await Promise.all(decoded.map((stem, i) => engine.loadStem(i, stem.pcm))) // transfers the PCM

engine.setBeatGrid(beats.map((beat) => ({ time: beat.t, downbeat: beat.is_downbeat })))
engine.setMixer([
  { gain: 1, muted: false, soloed: true, soloGain: dbToGain(stemsJson.stems[0].gain_to_unity_db) },
  { gain: 0.8, muted: false, soloed: false },
])
engine.setLoop({ start: bar(5), end: bar(9) }) // seconds; null clears it
engine.seek(bar(5))
engine.setRate(0.7)                            // 0.5–1.5
engine.setTranspose(-2)                        // semitones (ignored on the low CPU tier)
engine.setMetronome(true)
await engine.play({ countInBars: 1 })          // resumes the context if needed

engine.on('countIn', ({ index, accent, at }) => pulse(at, accent))       // at: performance.now() ms
engine.on('loopWrap', ({ pass }) => passes.set(pass))
engine.on('interrupted', () => showTapToResume())                         // iOS call, Siri, route change
engine.on('audio_underrun', (event) => analytics.capture('audio_underrun', event))

function frame() {
  const seconds = engine.position()            // what the listener hears now
  alphaTab.updatePosition(seconds * 1000)
  requestAnimationFrame(frame)
}
```

### API

| | |
|---|---|
| `loadDspModule(url?)` | Fetches and compiles `dsp.wasm` once per page. |
| `createEngine(options?)` | `context` (default: new 48 kHz `AudioContext`, interactive latency; tests pass an `OfflineAudioContext`), `module`, `destination`, `tier` (`high`/`mid`/`low`, default from the device), `adaptive` (step down on underruns, default true), `keepScreenOn` (Screen Wake Lock while playing, default true). Sets `navigator.audioSession.type = 'playback'` where it exists. |
| `decodeStem(bytes, { sampleRate, durationSeconds?, path? })` | WebCodecs (Mediabunny, in a Worker, resampled) where `AudioDecoder` exists, else `decodeAudioData`. Returns `{ pcm, frames, peaks, path }`: interleaved stereo Int16, exactly `durationSeconds × sampleRate` frames. Throws `DecodeError`. |
| `engine.loadStem(i, pcm)` / `unloadStem(i)` | Up to 8 stems. Rejects when the stem doesn't fit in memory. |
| `setGain(i, gain)`, `setMixer(channels)` | Linear gains (10 ms ramp, before the stretch); `setMixer` resolves mute/solo (`resolveGains`). |
| `setRate(rate)`, `setTranspose(semitones)` | Rate is clamped to 0.5–1.5; transpose uses an 8 kHz tonality limit. |
| `setLoop({ start, end } \| null)` | The loop wraps when the read position reaches `end`; seek into it to start there. |
| `setBeatGrid(beats)`, `setMetronome(on)`, `setClickVolume(gain)` | The grid drives the metronome, beat events and the count-in tempo. |
| `play({ countInBars })`, `pause()`, `seek(seconds)` | Count-in clicks at the tempo of the next beats ÷ rate; playback starts on the downbeat frame. |
| `position(now?)`, `timeOf(frame)`, `setDisplayOffset(seconds)` | Master clock (below); ±150 ms user offset. |
| `transport`, `duration`, `tier`, `ready` | |
| `on(event, listener)` | `loaded`, `started`, `stopped`, `ended`, `loopWrap`, `beat`, `countIn` (with `frame` and `at` = performance time heard), `interrupted`, `audio_underrun`, `load`, `error`, `processor` (raw protocol events). |
| `setMediaMetadata({ title, artist })` | Media Session: lock-screen and headset play/pause/seek. |
| `dispose()` | Disconnects, releases the wake lock, closes a context it created. |

`send(command)` and `flush()` speak the raw protocol (`src/protocol.ts`); commands take an optional `at` (context frame) to apply in that render quantum.

### Clock

The worklet reports `(context frame, heard source frame, rate)` every ~20 ms and on every transport change. The heard frame already excludes the stretcher's latency (`@splitune/audio-dsp` README, "Timing model"). The main thread finds the context time being heard now from `getOutputTimestamp()` and subtracts whatever part of `outputLatency + baseLatency` the timestamp doesn't already include (Chromium's includes it, WebKit's doesn't); without a timestamp, `currentTime − outputLatency − baseLatency`. It then extrapolates from the latest report at or before that time, wrapping into the loop.

### CPU tiers

`high` uses Signalsmith's default preset; `mid` the cheaper preset with split computation; `low` also disables pitch shift. The engine starts `mid` on Chromium devices reporting ≤ 4 GB and ≤ 4 cores, else `high`, and steps down once per trip when the worklet's load (processing ÷ audio time) stays above 0.75 for two 1 s windows or the context clock falls 20 ms behind wall time; each step emits `audio_underrun`.

## Tests

```bash
pnpm --filter @splitune/audio-engine test           # Node: scenarios through dsp.wasm, transport, clock, decode helpers
pnpm --filter @splitune/audio-engine test:browser   # Playwright: real AudioWorklet in an OfflineAudioContext, Chromium/Firefox/WebKit
```

Both run the same scenarios (`test/scenarios.ts`): duration at 0.5/0.75/1× (±1 quantum), pitch at 0.5× and +2 semitones (±5 cents), a 4-bar loop played five times (seam curvature and level), clock accuracy at three rates (≤ 5 ms), count-in at 0.7× (downbeat on the scheduled frame, first click ≤ 1 ms) and the mute ramp. The browser suite also decodes AAC (FFmpeg and AudioToolbox encodes) and Opus through both decode paths and checks length and offset; it needs `ffmpeg` (with libopus) on the PATH.

Playwright's Firefox doesn't start on macOS 27; run it from the Linux image instead:

```bash
docker run -d --rm --name pw-firefox --init -p 127.0.0.1:3333:3333 mcr.microsoft.com/playwright:v1.64.1-noble \
  sh -c "cd /tmp && npx -y playwright@1.64.1 run-server --port 3333 --host 0.0.0.0"
PW_FIREFOX_WS_ENDPOINT=ws://127.0.0.1:3333/ pnpm --filter @splitune/audio-engine test:browser
```

## Demo page (manual device checks)

```bash
pnpm --filter @splitune/audio-engine demo   # http://localhost:5175
```

Loads two stem files (optionally with their `stems.json` for the duration) or synthetic test stems, and drives every control: play/pause/seek, count-in, metronome, speed 50–100 % with presets, transpose, loop by bars, mute/solo, tier. **Measure** plays both stems at 0.5× for N seconds at a fixed tier and reports worklet load, underruns and the latencies the browser reports (Prototype 7). AudioWorklet needs a secure context: phones on the LAN need HTTPS in front of the dev server (`vite --host` behind Tailscale serve, or Caddy + mkcert; docs/implementation/25-personal-mode.md).

Manual checklist (docs/implementation/18-testing-strategy.md §2, 24-browser-compatibility.md §6): no audible click at the loop seam at 100 % and 70 %; 0.5× quality; count-in lands on the downbeat; mute/solo without clicks; cursor matches what you hear (adjust the display offset for Bluetooth); a phone call or Siri pauses with "Tap to resume"; Measure at 0.5× with no underruns.
