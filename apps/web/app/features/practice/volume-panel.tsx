import { useRef } from 'react'
import { usePracticeDefaults } from '@/lib/display-store'
import { m } from '@/lib/i18n'
import { PopoverContent } from '@/ui/popover-content'
import { Slider } from '@/ui/slider'
import { TransportButton } from '@/ui/transport-button'
import { volumeIcon } from './transport'

// Master volume (per device): mute and a fader. A tap on the track or on mute works without
// dragging (WCAG 2.5.7); unmute returns to the level before muting.
export function VolumeFields() {
  const volume = usePracticeDefaults((s) => s.volumePct)
  const update = usePracticeDefaults((s) => s.update)
  const restore = useRef(volume > 0 ? volume : 100)
  const label = m['practice.volume']()
  const Icon = volumeIcon(volume)
  return (
    <>
      <TransportButton
        size="practice"
        icon={<Icon aria-hidden />}
        label={m['practice.mute']()}
        showLabel={false}
        pressed={volume === 0}
        onPressedChange={(muted) => {
          if (muted) restore.current = volume
          update({ volumePct: muted ? 0 : restore.current })
        }}
      />
      <div className="w-37.5 shrink-0">
        <Slider
          value={volume}
          step={1}
          largeStep={10}
          onValueChange={(next) =>
            update({ volumePct: Array.isArray(next) ? (next[0] ?? 0) : next })
          }
          thumbLabels={[label]}
        />
      </div>
    </>
  )
}

// The transport's volume popover, loaded on first open so the slider and the popover's
// positioning stay out of the route's JS budget (12 §10).
export function VolumePanel() {
  return (
    <PopoverContent
      side="top"
      align="end"
      aria-label={m['practice.volume']()}
      className="w-auto flex-row items-center gap-2"
    >
      <VolumeFields />
    </PopoverContent>
  )
}
