// "Hear the tab" (27 §3.7.4): the bar's tab notes as plucked tones, at the current speed, through
// a short-lived AudioContext of their own (the practice engine is paused meanwhile). A simple
// pluck is enough to check a pitch or rhythm against "Hear this bar".

export interface PreviewNote {
  /** Seconds from the bar start (timeline time). */
  at: number
  duration: number
  midi: number
}

const MAX_SECONDS = 12

export async function playTabPreview(notes: readonly PreviewNote[], rate: number): Promise<void> {
  if (notes.length === 0 || typeof AudioContext === 'undefined') return
  const context = new AudioContext({ latencyHint: 'interactive' })
  await context.resume().catch(() => undefined)
  const start = context.currentTime + 0.05
  let end = start
  for (const note of notes) {
    const at = start + note.at / rate
    const length = Math.min(2, Math.max(0.15, note.duration / rate))
    if (at - start > MAX_SECONDS) break
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'triangle'
    oscillator.frequency.value = 440 * 2 ** ((note.midi - 69) / 12)
    gain.gain.setValueAtTime(0, at)
    gain.gain.linearRampToValueAtTime(0.25, at + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.001, at + length)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start(at)
    oscillator.stop(at + length + 0.02)
    end = Math.max(end, at + length + 0.05)
  }
  await new Promise((resolve) => setTimeout(resolve, (end - context.currentTime) * 1000 + 50))
  await context.close()
}
