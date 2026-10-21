import { CircleIcon, MicIcon, RotateCcwIcon, SquareIcon } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { formatDuration } from '@/lib/format'
import { m } from '@/lib/i18n'
import { Button } from '@/ui/button'
import { Label } from '@/ui/label'
import { Meter, MeterLabel } from '@/ui/meter'
import { InlineError } from '@/ui/status-message'
import { Switch } from '@/ui/switch'
import { recordingExtension, useRecorder } from './recorder'

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(performance.now()), 250)
    return () => clearInterval(timer)
  }, [])
  return (
    <span className="text-read-readout font-semibold tabular-nums">
      {formatDuration((now - since) / 1000)}
    </span>
  )
}

// Record tab (27 §3.6): explain before the browser asks for the microphone, then level meter,
// count-in and click, a practice-size Record button, a timer, and review before using the take.
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
        <Button
          variant="primary"
          loading={state.phase === 'requesting'}
          onClick={recorder.requestMicrophone}
        >
          <MicIcon aria-hidden />
          {state.phase === 'denied' ? m['common.try_again']() : m['import.allow_mic']()}
        </Button>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-5">
      <Meter
        value={level}
        min={0}
        max={100}
        getAriaValueText={() => `${level} %`}
        className="max-w-sm"
      >
        <MeterLabel>{m['import.input_level']()}</MeterLabel>
      </Meter>
      <div className="flex flex-wrap gap-6">
        <div className="flex items-center gap-3">
          <Switch id={`${id}-count`} checked={countIn} onCheckedChange={setCountIn} />
          <Label htmlFor={`${id}-count`}>{m['import.count_in']()}</Label>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            id={`${id}-click`}
            checked={click}
            onCheckedChange={setClick}
            disabled={!countIn}
          />
          <Label htmlFor={`${id}-click`}>{m['import.click']()}</Label>
        </div>
      </div>
      <div data-density="practice" className="flex flex-wrap items-center gap-4">
        {state.phase === 'ready' && (
          <Button
            variant="primary"
            size="practice"
            onClick={() => recorder.record({ countIn, clickOn: click })}
          >
            <CircleIcon aria-hidden />
            {m['import.record']()}
          </Button>
        )}
        {state.phase === 'counting' && (
          <p role="status" className="text-read-readout font-semibold tabular-nums">
            {m['import.counting']({ beat: String(state.beat) })}
          </p>
        )}
        {state.phase === 'recording' && (
          <>
            <Button variant="destructive" size="practice" onClick={recorder.stop}>
              <SquareIcon aria-hidden />
              {m['import.stop']()}
            </Button>
            <Elapsed since={state.startedAt} />
          </>
        )}
      </div>
      {state.phase === 'review' && (
        <div className="flex flex-col gap-3">
          <p className="text-base font-medium">
            {m['import.review']({ duration: formatDuration(state.durationS) })}
          </p>
          {/* biome-ignore lint/a11y/useMediaCaption: the user's own instrument recording has no speech */}
          <audio controls src={state.url} className="w-full max-w-md" />
          <Button variant="outline" className="self-start" onClick={recorder.discard}>
            <RotateCcwIcon aria-hidden />
            {m['import.record_again']()}
          </Button>
        </div>
      )}
    </div>
  )
}
