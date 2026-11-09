import { MicIcon, RotateCcwIcon } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { formatDuration } from '@/lib/format'
import { m } from '@/lib/i18n'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import { Label } from '@/ui/label'
import { Meter, MeterLabel } from '@/ui/meter'
import { InlineError } from '@/ui/status-message'
import { Switch } from '@/ui/switch'
import { recordingExtension, useRecorder } from './recorder'

function Elapsed({ since }: { since: number | undefined }) {
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    if (since === undefined) return
    const timer = setInterval(() => setNow(performance.now()), 250)
    return () => clearInterval(timer)
  }, [since])
  return (
    <span className="font-mono text-4xl leading-none font-semibold tabular-nums">
      {formatDuration(since === undefined ? 0 : Math.max(0, now - since) / 1000)}
    </span>
  )
}

// The 84 px round Record / Stop button (Phone-Add): a destructive ring around a red dot or square;
// red is the recording indicator (26 §4.5).
const ROUND = 'size-21 rounded-full [--face:5.25rem]'

// Record tab (27 §3.6, Phone-Add): explain before the browser asks for the microphone, then a card
// with the Recording badge, the mono timer, the input level, the round Record / Stop button and the
// Count-in and Click switches, the headset hint under it, and review before using the take.
export function RecordPanel({ onRecording }: { onRecording: (file: File | undefined) => void }) {
  const recorder = useRecorder()
  const { state, level } = recorder
  const [countIn, setCountIn] = useState(true)
  const [click, setClick] = useState(true)
  const id = useId()

  useEffect(() => {
    if (state.phase !== 'review') {
      onRecording(undefined)
      return
    }
    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
    const name = `${m['import.recording_name']({ when: stamp })}.${recordingExtension(state.blob.type)}`
    onRecording(new File([state.blob], name, { type: state.blob.type }))
  }, [state, onRecording])

  if (!recorder.supported || state.phase === 'unsupported') {
    return <InlineError tone="info" title={m['import.record_unsupported']()} />
  }
  if (state.phase === 'idle' || state.phase === 'requesting' || state.phase === 'denied') {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="text-base text-muted-foreground">{m['import.record_explainer']()}</p>
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
      <div className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-4">
        <p className="text-base font-[650]">
          {m['import.review']({ duration: formatDuration(state.durationS) })}
        </p>
        {/* biome-ignore lint/a11y/useMediaCaption: the user's own instrument recording has no speech */}
        <audio controls src={state.url} className="w-full" />
        <Button className="self-start" onClick={recorder.discard}>
          <RotateCcwIcon aria-hidden />
          {m['import.record_again']()}
        </Button>
      </div>
    )
  }
  const recording = state.phase === 'recording'
  return (
    <div className="flex flex-col gap-4.5">
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-border bg-card px-4 py-5">
        {recording && (
          <Badge variant="destructive" className="h-7 px-3">
            <span aria-hidden className="size-2 rounded-full bg-destructive" />
            {m['import.recording']()}
          </Badge>
        )}
        {state.phase === 'counting' ? (
          <p role="status" className="font-mono text-4xl leading-none font-semibold tabular-nums">
            {m['import.counting']({ beat: String(state.beat) })}
          </p>
        ) : (
          <Elapsed since={recording ? state.startedAt : undefined} />
        )}
        <Meter
          value={level}
          min={0}
          max={100}
          getAriaValueText={() => `${level} %`}
          className="w-full gap-y-1.5"
        >
          <MeterLabel className="text-sm font-normal text-faint-foreground">
            {m['import.input_level']()}
          </MeterLabel>
        </Meter>
        {recording ? (
          <Button
            variant="destructive"
            aria-label={m['import.stop_recording']()}
            className={ROUND}
            onClick={recorder.stop}
          >
            <span aria-hidden className="size-7.5 rounded-md bg-destructive" />
          </Button>
        ) : (
          <Button
            variant="destructive"
            aria-label={m['import.record']()}
            disabled={state.phase === 'counting'}
            className={ROUND}
            onClick={() => recorder.record({ countIn, clickOn: click })}
          >
            <span aria-hidden className="size-7.5 rounded-full bg-destructive" />
          </Button>
        )}
        <div className="flex gap-4.5">
          <div className="flex items-center gap-2">
            <Switch
              id={`${id}-count`}
              checked={countIn}
              onCheckedChange={setCountIn}
              disabled={recording}
            />
            <Label htmlFor={`${id}-count`}>{m['import.count_in']()}</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id={`${id}-click`}
              checked={click}
              onCheckedChange={setClick}
              disabled={!countIn || recording}
            />
            <Label htmlFor={`${id}-click`}>{m['import.click']()}</Label>
          </div>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{m['import.headset_hint']()}</p>
    </div>
  )
}
