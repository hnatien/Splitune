// Two synthetic stems at 120 BPM in 4/4 for testing without real stems: "part" (a plucked
// arpeggio, one note per beat) and "backing" (pad, kick on downbeats, hats on off-beats).
const BPM = 120
const BEAT = 60 / BPM

function render(
  sampleRate: number,
  seconds: number,
  voice: (t: number, beat: number, inBeat: number) => number,
) {
  const frames = Math.round(seconds * sampleRate)
  const pcm = new Int16Array(frames * 2)
  for (let i = 0; i < frames; i++) {
    const t = i / sampleRate
    const beat = Math.floor(t / BEAT)
    const sample = voice(t, beat, t - beat * BEAT)
    const value = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)))
    pcm[2 * i] = value
    pcm[2 * i + 1] = value
  }
  return pcm
}

const ARPEGGIO = [220, 261.63, 329.63, 440, 392, 329.63, 261.63, 246.94]

export function testStems(sampleRate: number, seconds = 32) {
  const part = render(sampleRate, seconds, (_t, beat, inBeat) => {
    const frequency = ARPEGGIO[beat % ARPEGGIO.length] ?? 220
    const envelope = Math.exp(-inBeat * 6) * Math.min(1, inBeat * 500)
    return (
      0.35 *
      envelope *
      (Math.sin(2 * Math.PI * frequency * inBeat) +
        0.3 * Math.sin(4 * Math.PI * frequency * inBeat))
    )
  })
  // Park–Miller generator: the same hats on every run.
  let hat = 22222
  const backing = render(sampleRate, seconds, (t, beat, inBeat) => {
    const pad =
      [110, 164.81, 220, 277.18].reduce((sum, f) => sum + Math.sin(2 * Math.PI * f * t), 0) * 0.04
    const kick =
      beat % 4 === 0 ? Math.exp(-inBeat * 20) * Math.sin(2 * Math.PI * 55 * inBeat) * 0.5 : 0
    hat = (hat * 16807) % 2147483647
    const offbeat = inBeat - BEAT / 2
    const hats = offbeat >= 0 ? Math.exp(-offbeat * 60) * (hat / 2147483647 - 0.5) * 0.2 : 0
    return pad + kick + hats
  })
  const beats = Array.from({ length: Math.floor(seconds / BEAT) }, (_, i) => ({
    time: i * BEAT,
    downbeat: i % 4 === 0,
  }))
  return {
    stems: [
      { name: 'part', pcm: part },
      { name: 'backing', pcm: backing },
    ],
    beats,
    bpm: BPM,
  }
}
