import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { HowStage } from './how-scenes'
import { PracticeStill } from './practice-still'
import { DAYLIGHT, expectReadablePictures, PHONE, VIEWPORTS } from './story-checks'

// The public pages' pictures of the app (27 §3.1–§3.2): Home's practice screen and How it works'
// four scenes, each one image with a text alternative, in both themes and on a phone.
const meta = {
  title: 'Screens/Marketing/Pictures',
  parameters: { viewport: { options: VIEWPORTS } },
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const scene = (step: number) => () => (
  <div className="max-w-2xl">
    <HowStage step={step} />
  </div>
)

export const Import: Story = {
  render: scene(0),
  play: async ({ canvasElement }) => {
    const picture = within(canvasElement).getByRole('img', { name: /^The import screen/ })
    await expect(within(picture).getByText('Ready to analyse')).toBeInTheDocument()
  },
}
export const ImportDaylight: Story = { render: scene(0), globals: DAYLIGHT }
export const Separate: Story = {
  render: scene(1),
  play: async ({ canvasElement }) => {
    // Every stem is named in words beside its hue; your part is the one with the ink edge.
    const picture = within(canvasElement).getByRole('img', { name: /guitar marked/ })
    for (const name of ['Guitar', 'Bass', 'Drums', 'Vocals']) {
      await expect(within(picture).getByText(name)).toBeInTheDocument()
    }
    await expect(within(picture).getByText('Your part')).toBeInTheDocument()
  },
}
export const SeparatePhone: Story = { render: scene(1), globals: { ...PHONE, ...DAYLIGHT } }
export const Transcribe: Story = {
  render: scene(2),
  play: async ({ canvasElement }) => expectReadablePictures(canvasElement),
}
export const TranscribeDaylight: Story = { render: scene(2), globals: DAYLIGHT }
export const TranscribePhone: Story = {
  render: scene(2),
  globals: PHONE,
  play: async ({ canvasElement }) => expectReadablePictures(canvasElement),
}
export const Practise: Story = {
  render: scene(3),
  play: async ({ canvasElement }) => {
    const picture = within(canvasElement).getByRole('img', { name: /^Bars 5 to 8 looped/ })
    // The pass prompt sits in the transport beside Play, with the keys printed on its answers.
    await expect(within(picture).getByText(/Best clean pass: 70/)).toBeInTheDocument()
    await expect(
      picture.querySelector('[data-slot=transport-button][data-tone=primary]'),
    ).not.toBeNull()
    const keys = [...picture.querySelectorAll('[data-slot=kbd]')].map((key) => key.textContent)
    await expect(keys).toEqual(expect.arrayContaining(['N', 'C']))
    await expectReadablePictures(canvasElement)
  },
}
export const PractiseDaylight: Story = { render: scene(3), globals: DAYLIGHT }
export const PractisePhone: Story = {
  render: scene(3),
  globals: PHONE,
  play: async ({ canvasElement }) => expectReadablePictures(canvasElement),
}

export const PracticeScreen: Story = {
  render: () => <PracticeStill />,
  play: async ({ canvasElement }) => {
    const picture = within(canvasElement).getByRole('img', { name: /^Splitune's practice screen/ })
    // A picture: nothing in it takes focus.
    await expect(picture.querySelector('[inert]')).not.toBeNull()
    await expect(within(picture).getByText('Loop · bars 5–8')).toBeInTheDocument()
    await expectReadablePictures(canvasElement)
  },
}
export const PracticeScreenDaylight: Story = {
  render: () => <PracticeStill />,
  globals: DAYLIGHT,
}
export const PracticeScreenPhone: Story = {
  render: () => <PracticeStill />,
  globals: PHONE,
  play: async ({ canvasElement }) => expectReadablePictures(canvasElement),
}
