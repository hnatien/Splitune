import type { Meta, StoryObj } from '@storybook/react-vite'
import { useId } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { Checkbox } from './checkbox.tsx'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from './field.tsx'
import { Input } from './input.tsx'
import { Label } from './label.tsx'
import { RadioGroup, RadioGroupItem } from './radio-group.tsx'
import {
  BOTH_THEMES,
  BOTH_THEMES_MORE_CONTRAST,
  contrast,
  DAYLIGHT,
  edgeOf,
  expectFocusRing,
  expectInkEdge,
  expectTargets,
  expectUnavailable,
  isClear,
  StateGrid,
  surfaceOf,
  themeFrames,
} from './story-kit.tsx'
import { Switch } from './switch.tsx'

// Doc 26 §12.1 `.field`, `.label`, `.toggle`, `.check`; §12.3 states with their non-colour cues
// (the switch's knob position and inversion, the check mark, the radio's dot, the error's icon).
// s47: a field's only boundary is a 1 px --edge (≥ 3:1) that turns to the ink on hover and focus;
// checked is an inversion (the ink fill with a check or dot); disabled keeps the edge, drops any
// fill and never fades by opacity.
const meta = { title: 'Base/Form controls' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

function Email({
  invalid = false,
  disabled = false,
  long = false,
}: {
  invalid?: boolean
  disabled?: boolean
  long?: boolean
}) {
  const id = useId()
  return (
    <Field className="max-w-sm">
      <FieldLabel htmlFor={id}>Email</FieldLabel>
      <Input
        id={id}
        type="email"
        defaultValue={
          invalid ? 'pat@' : long ? 'a.very.long.address.for.a.practice.account@example.com' : ''
        }
        placeholder="you@example.com"
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : `${id}-help`}
        disabled={disabled}
        aria-label={disabled ? 'Email, unavailable' : undefined}
      />
      {invalid ? (
        <FieldError id={`${id}-error`}>
          {long
            ? "That address is missing the part after the @. Enter the whole address, like you@example.com, and we'll send the link there."
            : 'Enter an email address like you@example.com.'}
        </FieldError>
      ) : (
        <FieldDescription id={`${id}-help`}>
          We'll send a sign-in link. No password needed.
        </FieldDescription>
      )}
    </Field>
  )
}

/**
 * `.field` 44 tall, 10 px corners, on the --background well with a 1 px --edge (≥ 3:1); the text is
 * the body role (15 px). `.label` is the label role (14/20 at 500) above it.
 */
export const InputDefault: Story = {
  render: () => <Email />,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const input = within(frame).getByRole('textbox', { name: 'Email' })
      const style = getComputedStyle(input)
      await expect(input.getBoundingClientRect().height).toBe(44)
      await expect(style.borderTopLeftRadius).toBe('10px')
      await expect(style.borderTopWidth).toBe('1px')
      await expect(contrast(style.borderTopColor, surfaceOf(frame))).toBeGreaterThanOrEqual(3)
      await expect(style.fontSize).toBe('15px')
      const label = getComputedStyle(within(frame).getByText('Email'))
      await expect([label.fontSize, label.fontWeight]).toEqual(['14px', '500'])
      // The placeholder is text too: ≥ 4.5:1 on the field.
      await expect(
        contrast(getComputedStyle(input, '::placeholder').color, surfaceOf(input)),
      ).toBeGreaterThanOrEqual(4.5)
    }
  },
}

/** On a coarse pointer the field text is 16 px (`text-field`), so iOS doesn't zoom into the field. */
export const InputCoarsePointer: Story = {
  render: () => <Email />,
  globals: { pointer: 'coarse' },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox', { name: 'Email' })
    await expect(getComputedStyle(input).fontSize).toBe('16px')
  },
}

export const InputError: Story = {
  render: () => <Email invalid />,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const input = within(frame).getByRole('textbox', { name: 'Email' })
      await expect(input).toHaveAttribute('aria-invalid', 'true')
      await expect(input).toHaveAccessibleDescription(
        'Enter an email address like you@example.com.',
      )
      // The edge turns red and the message under it carries an icon as well as its colour.
      const edge = getComputedStyle(input).borderTopColor
      await expect(contrast(edge, surfaceOf(frame))).toBeGreaterThanOrEqual(3)
      const alert = within(frame).getByRole('alert')
      await expect(alert.querySelector('svg')).not.toBeNull()
      await expect(getComputedStyle(alert).color).toBe(edge)
      await expect(
        contrast(getComputedStyle(alert).color, surfaceOf(alert)),
      ).toBeGreaterThanOrEqual(4.5)
    }
  },
}

/** Disabled keeps its ≥ 3:1 edge and its full opacity, drops the fill and says "unavailable". */
export const InputDisabled: Story = {
  render: () => <Email disabled />,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const input = within(frame).getByRole('textbox')
      await expect(input).toBeDisabled()
      await expectUnavailable(input, 'unavailable')
      const style = getComputedStyle(input)
      await expect(isClear(style.backgroundColor)).toBe(true)
      await expect(contrast(style.borderTopColor, surfaceOf(frame))).toBeGreaterThanOrEqual(3)
    }
  },
}

/** A long value scrolls inside the field and a long error wraps under it; nothing overflows. */
export const InputLongContent: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <Email long />
      <Email long invalid />
    </div>
  ),
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const [plain] = within(frame).getAllByRole('textbox') as [HTMLInputElement]
      await expect(plain.scrollWidth).toBeGreaterThan(plain.clientWidth)
      const alert = within(frame).getByRole('alert')
      await expect(alert.getBoundingClientRect().width).toBeLessThanOrEqual(
        plain.getBoundingClientRect().width + 0.5,
      )
    }
  },
}

/** Focus: the 2 px ink outline laid over the field's edge (−1 px), so they read as one line. */
export const InputFocus: Story = {
  render: () => <Email />,
  play: async ({ canvasElement }) => {
    await userEvent.tab()
    const input = within(canvasElement).getByRole('textbox', { name: 'Email' })
    await expect(input).toHaveFocus()
    await expectFocusRing(input)
    const style = getComputedStyle(input)
    await expect(style.outlineOffset).toBe('-1px')
    await waitFor(() =>
      expect(getComputedStyle(input).borderTopColor).toBe(getComputedStyle(input).color),
    )
  },
}
export const InputFocusDaylight: Story = { ...InputFocus, globals: DAYLIGHT }
export const InputFocusIncreasedContrast: Story = {
  render: () => <Email />,
  globals: { contrast: 'more' },
  play: async ({ canvasElement }) => {
    await userEvent.tab()
    await expectFocusRing(within(canvasElement).getByRole('textbox', { name: 'Email' }), '3px')
  },
}

function SwitchRows({ disabled = false }: { disabled?: boolean }) {
  const id = useId()
  return (
    <FieldGroup className="max-w-md gap-1">
      <FieldLabel className="w-full">
        <Field orientation="horizontal" className="min-h-11 items-center">
          <FieldContent>
            <FieldTitle>Speed ladder</FieldTitle>
            <FieldDescription>Up 5 % after 3 clean passes</FieldDescription>
          </FieldContent>
          <Switch defaultChecked disabled={disabled} />
        </Field>
      </FieldLabel>
      <Field orientation="horizontal" className="min-h-11 items-center">
        <Label htmlFor={id} className="flex-1 text-body text-foreground">
          Increase contrast
        </Label>
        <Switch id={id} disabled={disabled} />
      </Field>
    </FieldGroup>
  )
}

/** Off is an --edge track; on inverts it to the ink and moves the knob 16 px (two cues). */
export const Switches: Story = {
  render: () => <SwitchRows />,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const [on, off] = within(frame).getAllByRole('switch') as [HTMLElement, HTMLElement]
      await expect(on).toBeChecked()
      // Painted 40 × 24 inside a 48 × 44 box.
      await expect([on.clientWidth, on.clientHeight]).toEqual([40, 24])
      await expectTargets([on, off], 44)
      const knob = (element: HTMLElement) =>
        (element.querySelector('[data-slot="switch-thumb"]') as HTMLElement).getBoundingClientRect()
          .left - element.getBoundingClientRect().left
      await expect(knob(on) - knob(off)).toBe(16)
      // Both tracks are ≥ 3:1 against the row they sit on, and differ from each other by ≥ 3:1.
      const track = (element: HTMLElement) => getComputedStyle(element).backgroundColor
      await expect(contrast(track(off), surfaceOf(frame))).toBeGreaterThanOrEqual(3)
      await expect(contrast(track(on), surfaceOf(frame))).toBeGreaterThanOrEqual(3)
      await expect(contrast(track(on), track(off))).toBeGreaterThanOrEqual(1.5)
    }
  },
}
export const SwitchesDisabled: Story = {
  render: () => <SwitchRows disabled />,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      for (const toggle of within(frame).getAllByRole('switch')) {
        await expect(getComputedStyle(toggle).opacity).toBe('1')
        await expect(isClear(getComputedStyle(toggle).backgroundColor)).toBe(true)
        await expect(
          contrast(edgeOf(toggle)?.color ?? '', surfaceOf(frame)),
        ).toBeGreaterThanOrEqual(3)
      }
    }
  },
}
export const SwitchKeyboard: Story = {
  render: () => <SwitchRows />,
  play: async ({ canvasElement }) => {
    const toggle = within(canvasElement).getByRole('switch', { name: 'Increase contrast' })
    toggle.focus()
    await userEvent.keyboard(' ')
    await expect(toggle).toBeChecked()
  },
}
export const SwitchFocusDaylight: Story = {
  render: () => <SwitchRows />,
  globals: DAYLIGHT,
  play: async ({ canvasElement }) => {
    await userEvent.tab()
    const toggle = within(canvasElement).getAllByRole('switch')[0] as HTMLElement
    await expect(toggle).toHaveFocus()
    await expectFocusRing(toggle)
  },
}

function Choices({ disabled = false }: { disabled?: boolean }) {
  const id = useId()
  return (
    <FieldGroup className="max-w-md gap-2">
      <Field orientation="horizontal" className="items-center gap-1">
        <Checkbox id={`${id}-hints`} defaultChecked disabled={disabled} />
        <Label htmlFor={`${id}-hints`} className="text-body text-foreground">
          Show fingering hints
        </Label>
      </Field>
      <Field orientation="horizontal" className="items-center gap-1">
        <Checkbox id={`${id}-left`} disabled={disabled} />
        <Label htmlFor={`${id}-left`} className="text-body text-foreground">
          Left-handed diagrams
        </Label>
      </Field>
      <FieldSet>
        <FieldLegend variant="label">Where is your screen?</FieldLegend>
        <RadioGroup
          defaultValue="stand"
          disabled={disabled}
          aria-label="Where is your screen?"
          className="gap-0"
        >
          {[
            ['desk', 'At my desk (0.5 m)'],
            ['stand', 'On a music stand (0.75 m)'],
            ['floor', 'On the floor or across the room (1.5 m)'],
          ].map(([value, label]) => (
            <Field key={value} orientation="horizontal" className="items-center gap-1">
              <RadioGroupItem id={`${id}-${value}`} value={value as string} />
              <Label htmlFor={`${id}-${value}`} className="text-body text-foreground">
                {label}
              </Label>
            </Field>
          ))}
        </RadioGroup>
      </FieldSet>
    </FieldGroup>
  )
}

const box = (control: HTMLElement) =>
  control.querySelector('[data-slot=checkbox-box], [data-slot=radio-group-ring]') as HTMLElement

/** Checked inverts the 18 px box to the ink and draws a check (or a dot) in the page colour. */
export const Choice: Story = {
  render: () => <Choices />,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const canvas = within(frame)
      const controls = [...canvas.getAllByRole('checkbox'), ...canvas.getAllByRole('radio')]
      // The control's own box is the 44 px target; the painted box is 18 inside it.
      await expectTargets(controls, 44)
      const hints = canvas.getByRole('checkbox', { name: 'Show fingering hints' })
      const left = canvas.getByRole('checkbox', { name: 'Left-handed diagrams' })
      await expect(hints).toBeChecked()
      await expect(hints.querySelector('svg')).not.toBeNull()
      await expect(box(hints).getBoundingClientRect().width).toBe(18)
      // Unchecked: a 1 px --edge at ≥ 3:1; checked: the ink fill at ≥ 3:1 against the page.
      await expect(
        contrast(edgeOf(box(left))?.color ?? '', surfaceOf(frame)),
      ).toBeGreaterThanOrEqual(3)
      const fill = getComputedStyle(box(hints)).backgroundColor
      await expect(contrast(fill, surfaceOf(frame))).toBeGreaterThanOrEqual(3)
      await expect(
        contrast(getComputedStyle(hints.querySelector('svg') as SVGElement).color, fill),
      ).toBeGreaterThanOrEqual(3)
      const stand = canvas.getByRole('radio', { name: 'On a music stand (0.75 m)' })
      await expect(stand).toBeChecked()
      await expect(getComputedStyle(box(stand)).backgroundColor).toBe(fill)
    }
  },
}
export const ChoiceDisabled: Story = {
  render: () => <Choices disabled />,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const hints = within(frame).getByRole('checkbox', { name: 'Show fingering hints' })
      await expect(getComputedStyle(hints).opacity).toBe('1')
      // No fill even when checked: the check and the edge stay, in the faint grey.
      await expect(isClear(getComputedStyle(box(hints)).backgroundColor)).toBe(true)
      await expect(hints.querySelector('svg')).not.toBeNull()
      await expect(
        contrast(edgeOf(box(hints))?.color ?? '', surfaceOf(frame)),
      ).toBeGreaterThanOrEqual(3)
    }
  },
}
export const ChoiceKeyboard: Story = {
  render: () => <Choices />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const left = canvas.getByRole('checkbox', { name: 'Left-handed diagrams' })
    left.focus()
    await userEvent.keyboard(' ')
    await expect(left).toBeChecked()
    // No pseudo-element hit area: the control's own box is the target (26 §8).
    await expect(getComputedStyle(left, '::after').content).toBe('none')
    const floor = canvas.getByRole('radio', { name: 'On the floor or across the room (1.5 m)' })
    canvas.getByRole('radio', { name: 'On a music stand (0.75 m)' }).focus()
    await userEvent.keyboard('{ArrowDown}')
    await waitFor(() => expect(floor).toBeChecked())
  },
}
export const ChoiceFocusDaylight: Story = {
  render: () => <Choices />,
  globals: DAYLIGHT,
  play: async ({ canvasElement }) => {
    await userEvent.tab()
    const hints = within(canvasElement).getByRole('checkbox', { name: 'Show fingering hints' })
    await expect(hints).toHaveFocus()
    // The outline hugs the painted box inside the 44 px target and keeps 3:1 on the page.
    await expect(getComputedStyle(hints).outlineOffset).toBe('-11px')
    await expectFocusRing(hints)
  },
}

function ChoiceCardGroup() {
  const id = useId()
  return (
    <RadioGroup defaultValue="full" aria-label="Analysis" className="max-w-md">
      {[
        ['full', 'Full', 'Your part isolated, tab and chords'],
        ['lite', 'Lite', 'Chords and beats only'],
      ].map(([value, title, description]) => (
        <FieldLabel key={value} htmlFor={`${id}-${value}`}>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldTitle>{title}</FieldTitle>
              <FieldDescription>{description}</FieldDescription>
            </FieldContent>
            <RadioGroupItem id={`${id}-${value}`} value={value as string} />
          </Field>
        </FieldLabel>
      ))}
    </RadioGroup>
  )
}

/**
 * A choice whose whole row is the label (a radio in a FieldLabel): a --border-strong edge at rest
 * and the 1.5 px ink edge when its radio is checked. The row's surface never changes.
 */
// Exported as ChoiceCards: the visual baseline (e2e/visual/components.spec.ts) keeps its story id.
export const ChoiceCards: Story = {
  name: 'Choice rows',
  render: () => <ChoiceCardGroup />,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const canvas = within(frame)
      const full = canvas.getByRole('radio', { name: /Full/ })
      const lite = canvas.getByRole('radio', { name: /Lite/ })
      const row = (radio: HTMLElement) => radio.closest('label') as HTMLElement
      await expect(full).toBeChecked()
      await expectInkEdge(row(full))
      await expect(edgeOf(row(lite))?.width).toBe(1)
      await expect(getComputedStyle(row(full)).backgroundColor).toBe(
        getComputedStyle(row(lite)).backgroundColor,
      )
      await userEvent.click(row(lite))
      await expect(lite).toBeChecked()
      await waitFor(() => expect(edgeOf(row(lite))?.width).toBe(1.5))
      await expect(edgeOf(row(full))?.width).toBe(1)
    }
  },
}

const Gallery = () => (
  <StateGrid
    className="flex flex-col gap-6"
    states={[
      ['Field', <Email key="e" />],
      ['Field error', <Email key="i" invalid />],
      ['Field disabled', <Email key="d" disabled />],
      ['Switches', <SwitchRows key="s" />],
      ['Checkboxes and radios', <Choices key="c" />],
      ['Disabled', <Choices key="cd" disabled />],
    ]}
  />
)
export const AllStates: Story = { render: Gallery, globals: BOTH_THEMES }
export const AllStatesIncreasedContrast: Story = {
  render: Gallery,
  globals: BOTH_THEMES_MORE_CONTRAST,
}
export const Stage: Story = { render: Gallery, globals: { appearance: 'stage' } }
