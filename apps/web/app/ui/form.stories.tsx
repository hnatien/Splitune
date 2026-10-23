import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { Checkbox } from './checkbox.tsx'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from './field.tsx'
import { Input } from './input.tsx'
import { Label } from './label.tsx'
import { RadioGroup, RadioGroupItem } from './radio-group.tsx'
import { Switch } from './switch.tsx'

const meta = { title: 'Base/Form controls' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const Email = ({
  invalid = false,
  disabled = false,
}: {
  invalid?: boolean
  disabled?: boolean
}) => (
  <Field className="max-w-sm">
    <FieldLabel htmlFor="email">Email</FieldLabel>
    <Input
      id="email"
      type="email"
      defaultValue={invalid ? 'pat@' : ''}
      placeholder="you@example.com"
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? 'email-error' : 'email-help'}
      disabled={disabled}
    />
    {invalid ? (
      <FieldError id="email-error">Enter an email address like you@example.com.</FieldError>
    ) : (
      <FieldDescription id="email-help">
        We'll send a sign-in link. No password needed.
      </FieldDescription>
    )}
  </Field>
)

export const InputDefault: Story = { render: () => <Email /> }
export const InputError: Story = { render: () => <Email invalid /> }
export const InputDisabled: Story = { render: () => <Email disabled /> }
export const InputFocus: Story = {
  render: () => <Email />,
  play: async ({ canvasElement }) => {
    await userEvent.tab()
    await expect(within(canvasElement).getByRole('textbox', { name: 'Email' })).toHaveFocus()
  },
}

const Choices = ({ disabled = false }: { disabled?: boolean }) => (
  <FieldGroup className="max-w-md">
    <Field orientation="horizontal">
      <Checkbox id="hints" defaultChecked disabled={disabled} />
      <Label htmlFor="hints">Show fingering hints</Label>
    </Field>
    <Field orientation="horizontal">
      <Checkbox id="left" disabled={disabled} />
      <Label htmlFor="left">Left-handed diagrams</Label>
    </Field>
    <Field orientation="horizontal">
      <Switch id="contrast" defaultChecked disabled={disabled} />
      <Label htmlFor="contrast">Increase contrast</Label>
    </Field>
    <FieldSet>
      <FieldLegend variant="label">Where is your screen?</FieldLegend>
      <RadioGroup defaultValue="stand" disabled={disabled} aria-label="Where is your screen?">
        {[
          ['desk', 'At my desk (0.5 m)'],
          ['stand', 'On a music stand (0.75 m)'],
          ['floor', 'On the floor or across the room (1.5 m)'],
        ].map(([value, label]) => (
          <Field key={value} orientation="horizontal">
            <RadioGroupItem id={`distance-${value}`} value={value as string} />
            <Label htmlFor={`distance-${value}`}>{label}</Label>
          </Field>
        ))}
      </RadioGroup>
    </FieldSet>
  </FieldGroup>
)

export const Choice: Story = { render: () => <Choices /> }
export const ChoiceDisabled: Story = { render: () => <Choices disabled /> }
export const ChoiceKeyboard: Story = {
  render: () => <Choices />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const left = canvas.getByRole('checkbox', { name: 'Left-handed diagrams' })
    left.focus()
    await userEvent.keyboard(' ')
    await expect(left).toBeChecked()
    const hit = getComputedStyle(left, '::after')
    await expect(Number.parseFloat(hit.width)).toBeGreaterThanOrEqual(44)
  },
}

const Gallery = () => (
  <div className="flex flex-col gap-8">
    <Email />
    <Email invalid />
    <Choices />
  </div>
)
export const Dark: Story = { render: Gallery, globals: { appearance: 'dark' } }
export const Stage: Story = { render: Gallery, globals: { appearance: 'stage' } }
export const IncreasedContrast: Story = { render: Gallery, globals: { contrast: 'more' } }

/** Fields sit on the raised surface, which in Dark is lighter than the page. */
export const InputRaisedDark: Story = {
  render: () => <Email />,
  globals: { appearance: 'dark' },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox', { name: 'Email' })
    await expect(getComputedStyle(input).backgroundColor).not.toBe(
      getComputedStyle(document.body).backgroundColor,
    )
  },
}
