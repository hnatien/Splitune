// Test signals as interleaved stereo Int16 PCM (the format the engine loads), shared by the Node
// tests and the browser harness.

export function tone(sampleRate: number, seconds: number, frequency: number, amplitude = 0.5) {
  const frames = Math.round(seconds * sampleRate)
  const pcm = new Int16Array(frames * 2)
  for (let i = 0; i < frames; i++) {
    const sample = Math.round(
      32767 * amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate),
    )
    pcm[2 * i] = sample
    pcm[2 * i + 1] = sample
  }
  return pcm
}

// A chord of slightly detuned partials with slow amplitude movement: dense enough that a seam
// discontinuity shows up as a broadband spike, smooth enough that the music itself doesn't.
export function chord(sampleRate: number, seconds: number, amplitude = 0.3) {
  const partials = [110, 164.81, 220.5, 277.18, 329.63, 440.7, 554.37, 659.26]
  const frames = Math.round(seconds * sampleRate)
  const pcm = new Int16Array(frames * 2)
  for (let i = 0; i < frames; i++) {
    const t = i / sampleRate
    let sample = 0
    for (const [k, f] of partials.entries()) {
      sample +=
        Math.sin(2 * Math.PI * f * t + k) * (0.7 + 0.3 * Math.sin(2 * Math.PI * 0.3 * t + k))
    }
    const value = Math.round((32767 * amplitude * sample) / partials.length)
    pcm[2 * i] = value
    pcm[2 * i + 1] = value
  }
  return pcm
}

// Short 3 kHz bursts (2 ms, Hann window) at the given times in seconds; silence elsewhere.
export function clickTrack(sampleRate: number, seconds: number, times: number[], amplitude = 0.8) {
  const frames = Math.round(seconds * sampleRate)
  const length = Math.round(0.002 * sampleRate)
  const pcm = new Int16Array(frames * 2)
  for (const time of times) {
    const start = Math.round(time * sampleRate)
    for (let i = 0; i < length && start + i < frames; i++) {
      const window = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / length)
      const value = Math.round(
        32767 * amplitude * window * Math.sin((2 * Math.PI * 3000 * i) / sampleRate),
      )
      pcm[2 * (start + i)] = value
      pcm[2 * (start + i) + 1] = value
    }
  }
  return pcm
}

// Beat grid in source frames for a steady tempo, with downbeats every `beatsPerBar` beats.
export function beatGrid(sampleRate: number, seconds: number, bpm: number, beatsPerBar = 4) {
  const period = 60 / bpm
  const count = Math.floor(seconds / period) + 1
  const frames = new Float64Array(count)
  const downbeats = new Uint8Array(count)
  for (let i = 0; i < count; i++) {
    frames[i] = Math.round(i * period * sampleRate)
    downbeats[i] = i % beatsPerBar === 0 ? 1 : 0
  }
  return { frames, downbeats }
}
