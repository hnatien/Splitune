import { MicIcon, PauseIcon, PlayIcon, RotateCcwIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { formatDuration } from '@/lib/format'
import { m } from '@/lib/i18n'
import { Button } from '@/ui/button'
import { Meter, MeterLabel, MeterValue } from '@/ui/meter'
import { InlineError } from '@/ui/status-message'
import { Switch } from '@/ui/switch'
import { WaveformPreview } from '@/ui/waveform-preview'
import { useKeys } from '../practice/keys-store'
import { decodeLocally } from './local-audio'
import { recordingExtension, useRecorder } from './recorder'

/** Starts and stops a take without leaving the instrument (it follows the single-key switch). */
export const RECORD_KEY = 'R'

function Elapsed({ since }: { since: number | undefined }) {
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    if (since === undefined) return
    const timer = setInterval(() => setNow(performance.now()), 250)
    return () => clearInterval(timer)
  }, [since])
  return (
    <span className="text-display tabular-nums">
      {formatDuration(since === undefined ? 0 : Math.max(0, now - since) / 1000)}
    </span>
  )
}

// The 84 px round Record / Stop button (Phone-Add): a destructive ring around a red dot that
// becomes a square while recording; red is the recording indicator (26 §4.3), the shape says it.
const ROUND = 'size-21 rounded-full [--face:5.25rem]'

// Record tab (27 §3.6, Phone-Add): explain before the browser asks for the microphone; then the
// take in one column, nothing boxed: "Recording" with its dot, the timer, the input level, the
// round Record / Stop button (R), the Count-in and Click switches, the headset hint; then the take
// as a waveform with Play and Record again before it is used. Without recording in this browser it
// points to a file or a link.
export function RecordPanel({
  onRecording,
  onUseTab,
}: {
  onRecording: (file: File | undefined) => void
  onUseTab: (tab: 'file' | 'link') => void
}) {
  const recorder = useRecorder()
  const { state, level } = recorder
  const [countIn, setCountIn] = useState(true)
  const [click, setClick] = useState(true)
  const [take, setTake] = useState<File | undefined>()
  const singleKeys = useKeys((s) => s.singleKeys)
  const id = useId()

  useEffect(() => {
    if (state.phase !== 'review') {
      setTake(undefined)
      onRecording(undefined)
      return
    }
    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
    const name = `${m['import.recording_name']({ when: stamp })}.${recordingExtension(state.blob.type)}`
    const file = new File([state.blob], name, { type: state.blob.type })
    setTake(file)
    onRecording(file)
  }, [state, onRecording])

  const recording = state.phase === 'recording'
  const armed = state.phase === 'ready' || recording
  const toggle = recording ? recorder.stop : () => recorder.record({ countIn, clickOn: click })
  const latest = useRef(toggle)
  latest.current = toggle
  useEffect(() => {
    if (!armed || !singleKeys) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== RECORD_KEY.toLowerCase() || event.repeat) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target instanceof HTMLElement ? event.target : null
      if (target?.isContentEditable || target?.closest('input, textarea, select')) return
      event.preventDefault()
      latest.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [armed, singleKeys])

  if (!recorder.supported || state.phase === 'unsupported') {
    return (
      <InlineError
        tone="info"
        title={m['import.record_unsupported']()}
        actions={
          <>
            <Button onClick={() => onUseTab('file')}>{m['import.record_use_file']()}</Button>
            <Button variant="quiet" onClick={() => onUseTab('link')}>
              {m['import.record_use_link']()}
            </Button>
          </>
        }
      />
    )
  }
  if (state.phase === 'idle' || state.phase === 'requesting' || state.phase === 'denied') {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="text-body text-muted-foreground">{m['import.record_explainer']()}</p>
        {state.phase === 'denied' && <InlineError title={m['record.permission_denied']()} />}
        <Button loading={state.phase === 'requesting'} onClick={recorder.requestMicrophone}>
          <MicIcon aria-hidden />
          {state.phase === 'denied' ? m['common.try_again']() : m['import.allow_mic']()}
        </Button>
      </div>
    )
  }
  if (state.phase === 'review') {
    return (
      <TakeReview
        url={state.url}
        take={take}
        durationS={state.durationS}
        onAgain={recorder.discard}
      />
    )
  }
  return (
    <div className="flex flex-col items-center gap-5">
      <p
        role="status"
        className="flex min-h-6 items-center gap-2 text-label-sm text-muted-foreground"
      >
        {recording && (
          <>
            <span aria-hidden className="size-2 rounded-full bg-destructive" />
            <span className="text-foreground">{m['import.recording']()}</span>
          </>
        )}
        {state.phase === 'counting' && m['import.counting']({ beat: String(state.beat) })}
      </p>
      <Elapsed since={recording ? state.startedAt : undefined} />
      <Meter
        value={level}
        min={0}
        max={100}
        getAriaValueText={() => `${level} %`}
        className="w-full max-w-80"
      >
        <MeterLabel className="text-body-sm text-muted-foreground">
          {m['import.input_level']()}
        </MeterLabel>
        <MeterValue>{() => `${level} %`}</MeterValue>
      </Meter>
      <div className="flex flex-col items-center gap-2">
        {recording ? (
          <Button
            variant="destructive"
            aria-label={m['import.stop_recording']()}
            aria-keyshortcuts={singleKeys ? RECORD_KEY : undefined}
            className={ROUND}
            onClick={recorder.stop}
          >
            <span aria-hidden className="size-7.5 rounded-media bg-destructive" />
          </Button>
        ) : (
          <Button
            variant="destructive"
            aria-label={m['import.record']()}
            aria-keyshortcuts={singleKeys ? RECORD_KEY : undefined}
            disabled={state.phase === 'counting'}
            className={ROUND}
            onClick={toggle}
          >
            <span aria-hidden className="size-7.5 rounded-full bg-destructive" />
          </Button>
        )}
        {singleKeys && (
          <span className="text-caption text-muted-foreground pointer-coarse:hidden">
            {m['import.record_key']({ key: RECORD_KEY })}
          </span>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
        <div className="flex min-h-target items-center gap-2">
          <Switch
            id={`${id}-count`}
            checked={countIn}
            onCheckedChange={setCountIn}
            disabled={recording}
          />
          <label htmlFor={`${id}-count`} className="text-label">
            {m['import.count_in']()}
          </label>
        </div>
        <div className="flex min-h-target items-center gap-2">
          <Switch
            id={`${id}-click`}
            checked={click}
            onCheckedChange={setClick}
            disabled={!countIn || recording}
          />
          <label htmlFor={`${id}-click`} className="text-label">
            {m['import.click']()}
          </label>
        </div>
      </div>
      <p className="text-center text-body-sm text-muted-foreground">{m['import.headset_hint']()}</p>
    </div>
  )
}

/** The take as its waveform (decoded here, like a picked file), Play / Pause and Record again. */
function TakeReview({
  url,
  take,
  durationS,
  onAgain,
}: {
  url: string
  take: File | undefined
  durationS: number
  onAgain: () => void
}) {
  const audio = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [peaks, setPeaks] = useState<number[] | undefined>()
  useEffect(() => {
    if (!take) return
    let live = true
    void decodeLocally(take).then((decoded) => {
      if (live && decoded.kind === 'decoded') setPeaks(decoded.stats.peaks)
    })
    return () => {
      live = false
    }
  }, [take])
  const duration = formatDuration(durationS)
  return (
    <div className="flex flex-col gap-3">
      <p className="text-label">{m['import.review']({ duration })}</p>
      {peaks && (
        <WaveformPreview
          className="h-11"
          peaks={peaks}
          label={m['import.waveform_label']({ name: m['import.recording'](), duration })}
        />
      )}
      {/* biome-ignore lint/a11y/useMediaCaption: the learner's own instrument take has no speech */}
      <audio
        ref={audio}
        src={url}
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            const element = audio.current
            if (!element) return
            if (element.paused) void element.play()
            else element.pause()
          }}
        >
          {playing ? <PauseIcon aria-hidden /> : <PlayIcon aria-hidden />}
          {playing ? m['import.take_pause']() : m['import.take_play']()}
        </Button>
        <Button variant="quiet" onClick={onAgain}>
          <RotateCcwIcon aria-hidden />
          {m['import.record_again']()}
        </Button>
      </div>
    </div>
  )
}
