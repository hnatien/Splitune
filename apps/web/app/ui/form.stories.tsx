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
  DAYLIGHT,
  expectTargets,
  StateGrid,
  themeFrames,
} from './story-kit.tsx'
import { Switch } from './switch.tsx'

// Doc 26 §12.1 `.field`, `.label`, `.toggle`, `.check`; §12.3 states with their non-colour cues
// (the switch's knob position and edge, the check mark, the radio's dot, the error's icon).
const meta = { title: 'Base/Form controls' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

function Email({ invalid = false, disabled = false }: { invalid?: boolean; disabled?: boolean }) {
  const id = useId()
  return (
    <Field className="max-w-sm">
      <FieldLabel htmlFor={id}>Email</FieldLabel>
      <Input
        id={id}
        type="email"
        defaultValue={invalid ? 'pat@' : ''}
        placeholder="you@example.com"
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : `${id}-help`}
        disabled={disabled}
        aria-label={disabled ? 'Email, unavailable' : undefined}
      />
      {invalid ? (
        <FieldError id={`${id}-error`}>Enter an email address like you@example.com.</FieldError>
      ) : (
        <FieldDescription id={`${id}-help`}>
          We'll send a sign-in link. No password needed.
        </FieldDescription>
      )}
    </Field>
  )
}

/** `.field` 44 tall on the --background well with an --input edge; `.label` 13/600 muted. */
export const InputDefault: Story = {
  render: () => <Email />,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const input = within(frame).getByRole('textbox', { name: 'Email' })
      await expect(input.getBoundingClientRect().height).toBe(44)
      const label = getComputedStyle(within(frame).getByText('Email'))
      await expect([label.fontSize, label.fontWeight]).toEqual(['13px', '600'])
    }
  },
}
export const InputError: Story = {
  render: () => <Email invalid />,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const input = within(frame).getByRole('textbox', { name: 'Email' })
      await expect(input).toHaveAccessibleDescription(
        'Enter an email address like you@example.com.',
      )
      // The message carries an icon as well as its colour.
      await expect(within(frame).getByRole('alert').querySelector('svg')).not.toBeNull()
    }
  },
}
export const InputDisabled: Story = { render: () => <Email disabled />, globals: BOTH_THEMES }

export const InputHover: Story = {
  render: () => <Email />,
  play: async ({ canvasElement }) => {
    await userEvent.hover(within(canvasElement).getByRole('textbox'))
  },
}

/** Focus: the 2 px ring 1 px off the field's edge (mockup `.field:focus`). */
export const InputFocus: Story = {
  render: () => <Email />,
  play: async ({ canvasElement }) => {
    await userEvent.tab()
    const input = within(canvasElement).getByRole('textbox', { name: 'Email' })
    await expect(input).toHaveFocus()
    const style = getComputedStyle(input)
    await expect([style.outlineWidth, style.outlineOffset]).toEqual(['2px', '1px'])
  },
}
export const InputFocusDaylight: Story = { ...InputFocus, globals: DAYLIGHT }

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
        <Label htmlFor={id} className="flex-1 text-base text-foreground">
          Increase contrast
        </Label>
        <Switch id={id} disabled={disabled} />
      </Field>
    </FieldGroup>
  )
}

/** Off and on: the knob's position, plus the on track's --signal edge (V16). */
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
    }
  },
}
export const SwitchesDisabled: Story = {
  render: () => <SwitchRows disabled />,
  globals: BOTH_THEMES,
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
    await expect(within(canvasElement).getAllByRole('switch')[0]).toHaveFocus()
  },
}

function Choices({ disabled = false }: { disabled?: boolean }) {
  const id = useId()
  return (
    <FieldGroup className="max-w-md gap-2">
      <Field orientation="horizontal" className="items-center gap-1">
        <Checkbox id={`${id}-hints`} defaultChecked disabled={disabled} />
        <Label htmlFor={`${id}-hints`} className="text-base text-foreground">
          Show fingering hints
        </Label>
      </Field>
      <Field orientation="horizontal" className="items-center gap-1">
        <Checkbox id={`${id}-left`} disabled={disabled} />
        <Label htmlFor={`${id}-left`} className="text-base text-foreground">
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
              <Label htmlFor={`${id}-${value}`} className="text-base text-foreground">
                {label}
              </Label>
            </Field>
          ))}
        </RadioGroup>
      </FieldSet>
    </FieldGroup>
  )
}

/** Checked: --signal fill with a --primary-foreground check (or dot), not colour alone. */
export const Choice: Story = {
  render: () => <Choices />,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const canvas = within(frame)
      const controls = [...canvas.getAllByRole('checkbox'), ...canvas.getAllByRole('radio')]
      // The control's own box is the 44 px target; the painted box is 18 inside it.
      await expectTargets(controls, 44)
      await expect(canvas.getByRole('checkbox', { name: 'Show fingering hints' })).toBeChecked()
      await expect(
        canvas.getByRole('checkbox', { name: 'Show fingering hints' }).querySelector('svg'),
      ).not.toBeNull()
    }
  },
}
export const ChoiceDisabled: Story = { render: () => <Choices disabled />, globals: BOTH_THEMES }
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
    await expect(getComputedStyle(hints).outlineOffset).toBe('-11px')
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

/** Choice cards (a radio in a FieldLabel): checked = --signal edge + inset ring + wash. */
export const ChoiceCards: Story = { render: () => <ChoiceCardGroup />, globals: BOTH_THEMES }

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
