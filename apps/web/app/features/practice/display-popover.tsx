import { useId } from 'react'
import { appearanceLabel } from '@/lib/appearance'
import { useDisplay, usePracticeDefaults } from '@/lib/display-store'
import { formatPercent } from '@/lib/format'
import { m } from '@/lib/i18n'
import { Label } from '@/ui/label'
import { PopoverContent, PopoverTitle } from '@/ui/popover-content'
import { Slider } from '@/ui/slider'
import { Switch } from '@/ui/switch'
import { OptionSegments } from '../common/option-segments'
import { PanelSection } from '../common/panel-section'

// The ⚙ Display popover's content (27 §3.7.4): appearance, score surface, distance + calibration,
// hyperlegible font, uncertainty marks, reduced motion and the tab layout. Per device, applied
// at once (26 §2); the same controls live in Settings → Display & practice.

function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (on: boolean) => void
}) {
  const id = useId()
  return (
    <div className="flex items-center gap-3">
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id}>{label}</Label>
    </div>
  )
}

export function DisplayPanel() {
  const display = useDisplay()
  const practice = usePracticeDefaults()
  const calibrationId = useId()
  return (
    <PopoverContent align="end" className="max-h-[80dvh] w-[22rem] gap-4 overflow-y-auto">
      <PopoverTitle>{m['practice.display']()}</PopoverTitle>
      <PanelSection title={m['practice.display_section_look']()}>
        <OptionSegments
          label={m['nav.appearance']()}
          value={display.appearance}
          options={(['system', 'light', 'dark', 'stage'] as const).map((value) => ({
            value,
            label: appearanceLabel(value),
          }))}
          onChange={(appearance) => display.update({ appearance })}
        />
        <OptionSegments
          label={m['settings.score']()}
          value={display.score}
          options={[
            { value: 'paper', label: m['settings.score_paper']() },
            { value: 'match', label: m['settings.score_match']() },
          ]}
          onChange={(score) => display.update({ score })}
        />
      </PanelSection>
      <PanelSection title={m['practice.display_section_reading']()}>
        <OptionSegments
          label={m['settings.distance']()}
          value={display.distance ?? 'auto'}
          options={[
            { value: 'auto', label: m['settings.distance_auto']() },
            { value: 'desk', label: m['settings.distance_desk']() },
            { value: 'stand', label: m['settings.distance_stand']() },
            { value: 'floor', label: m['settings.distance_floor']() },
          ]}
          onChange={(distance) =>
            display.update({ distance: distance === 'auto' ? undefined : distance })
          }
        />
        <div className="flex flex-col gap-2">
          <Label id={calibrationId}>{m['settings.calibration']()}</Label>
          <Slider
            aria-labelledby={calibrationId}
            thumbLabels={[m['settings.calibration']()]}
            min={0.8}
            max={1.4}
            step={0.1}
            largeStep={0.2}
            value={display.calibration}
            onValueChange={(value) => display.update({ calibration: Number(value) })}
          />
          <p className="text-sm text-muted-foreground tabular-nums">
            {formatPercent(display.calibration * 100)}
          </p>
        </div>
        <SwitchRow
          label={m['settings.hyperlegible']()}
          checked={display.readingFont === 'hyperlegible'}
          onChange={(on) => display.update({ readingFont: on ? 'hyperlegible' : 'inter' })}
        />
        <SwitchRow
          label={m['practice.show_uncertainty']()}
          checked={practice.showUncertainty}
          onChange={(on) => practice.update({ showUncertainty: on })}
        />
      </PanelSection>
      <PanelSection title={m['practice.display_section_motion']()}>
        <OptionSegments
          label={m['settings.reduced_motion']()}
          value={display.motion}
          options={[
            { value: 'system', label: m['settings.follow_system']() },
            { value: 'reduce', label: m['settings.on']() },
            { value: 'full', label: m['settings.off']() },
          ]}
          onChange={(motion) => display.update({ motion })}
        />
        <OptionSegments
          label={m['practice.tab_layout']()}
          value={practice.notationLayout}
          options={[
            { value: 'page', label: m['practice.tab_layout_page']() },
            { value: 'scroll', label: m['practice.tab_layout_scroll']() },
          ]}
          onChange={(notationLayout) => practice.update({ notationLayout })}
        />
      </PanelSection>
    </PopoverContent>
  )
}
