import { useCallback, useEffect, useRef, useState } from 'react'

// Record yourself (13 §3, 24 §3): getUserMedia with processing off → MediaRecorder in the first
// MIME type this browser supports (WebM/Opus in Chromium and Firefox, MP4/AAC in Safari), an input
// level meter and an optional count-in click.

const MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/webm',
  'audio/ogg;codecs=opus',
]

export function recordingMimeType(isSupported: (type: string) => boolean): string | undefined {
  return MIME_TYPES.find((type) => isSupported(type))
}

export function recordingExtension(mime: string): string {
  if (mime.startsWith('audio/mp4')) return 'm4a'
  if (mime.startsWith('audio/ogg')) return 'ogg'
  return 'webm'
}

export type RecorderState =
  | { phase: 'idle' }
  | { phase: 'requesting' }
  | { phase: 'denied' }
  | { phase: 'unsupported' }
  | { phase: 'ready' }
  | { phase: 'counting'; beat: number }
  | { phase: 'recording'; startedAt: number }
  | { phase: 'review'; blob: Blob; url: string; durationS: number }

const COUNT_IN_BEATS = 4
const COUNT_IN_BPM = 100

export function useRecorder() {
  const [state, setState] = useState<RecorderState>({ phase: 'idle' })
  const [level, setLevel] = useState(0)
  const stream = useRef<MediaStream | undefined>(undefined)
  const context = useRef<AudioContext | undefined>(undefined)
  const recorder = useRef<MediaRecorder | undefined>(undefined)
  const frame = useRef(0)
  const supported =
    typeof window !== 'undefined' &&
    typeof MediaRecorder === 'function' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function'

  const release = useCallback(() => {
    cancelAnimationFrame(frame.current)
    for (const track of stream.current?.getTracks() ?? []) track.stop()
    stream.current = undefined
    void context.current?.close()
    context.current = undefined
  }, [])

  useEffect(() => release, [release])

  const requestMicrophone = useCallback(async () => {
    if (!supported) {
      setState({ phase: 'unsupported' })
      return
    }
    setState({ phase: 'requesting' })
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      })
    } catch {
      setState({ phase: 'denied' })
      return
    }
    const audio = new AudioContext()
    context.current = audio
    const analyser = audio.createAnalyser()
    analyser.fftSize = 1024
    audio.createMediaStreamSource(stream.current).connect(analyser)
    const samples = new Float32Array(analyser.fftSize)
    const tick = () => {
      analyser.getFloatTimeDomainData(samples)
      let peak = 0
      for (const sample of samples) peak = Math.max(peak, Math.abs(sample))
      setLevel(Math.round(Math.min(1, peak) * 100))
      frame.current = requestAnimationFrame(tick)
    }
    tick()
    setState({ phase: 'ready' })
  }, [supported])

  const click = useCallback((accent: boolean) => {
    const audio = context.current
    if (!audio) return
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.frequency.value = accent ? 1500 : 1000
    gain.gain.setValueAtTime(0.3, audio.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.05)
    osc.connect(gain).connect(audio.destination)
    osc.start()
    osc.stop(audio.currentTime + 0.06)
  }, [])

  const begin = useCallback(() => {
    const source = stream.current
    const mime = recordingMimeType((type) => MediaRecorder.isTypeSupported(type))
    if (!source || !mime) {
      setState({ phase: 'unsupported' })
      return
    }
    const chunks: Blob[] = []
    const media = new MediaRecorder(source, { mimeType: mime })
    const startedAt = performance.now()
    media.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    media.onstop = () => {
      const blob = new Blob(chunks, { type: mime })
      setState({
        phase: 'review',
        blob,
        url: URL.createObjectURL(blob),
        durationS: (performance.now() - startedAt) / 1000,
      })
    }
    recorder.current = media
    media.start(1000)
    setState({ phase: 'recording', startedAt })
  }, [])

  const record = useCallback(
    async ({ countIn, clickOn }: { countIn: boolean; clickOn: boolean }) => {
      await context.current?.resume()
      if (!countIn) {
        begin()
        return
      }
      const beatMs = 60_000 / COUNT_IN_BPM
      for (let beat = 1; beat <= COUNT_IN_BEATS; beat++) {
        setState({ phase: 'counting', beat })
        if (clickOn) click(beat === 1)
        await new Promise((resolve) => setTimeout(resolve, beatMs))
      }
      begin()
    },
    [begin, click],
  )

  const stop = useCallback(() => recorder.current?.stop(), [])

  const discard = useCallback(() => {
    setState((current) => {
      if (current.phase === 'review') URL.revokeObjectURL(current.url)
      return { phase: 'ready' }
    })
  }, [])

  return { state, level, supported, requestMicrophone, record, stop, discard, release }
}
