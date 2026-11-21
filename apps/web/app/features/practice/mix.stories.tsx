import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { AppStory } from '../../../.storybook/app.tsx'
import { useMixerPrefs } from './mixer-prefs'
import { PracticePage } from './practice-page'
import { usePracticeUi } from './practice-store'
import {
  ALL,
  coarse,
  type Patch,
  SIX_STEMS,
  SONG_ID,
  seed,
  TWO_STEMS,
  tone,
} from './practice-story-data'

// The Mix tab with every stem (27 §3.7.4, Practice-Mix.dc.html; s40b) on the practice screen:
// six stems with Rhythm only, the fixture's run (guitar, drums, other: no Rhythm only, a Rough
// drum stem), the two-channel fallback (your part and the Band), solo, mute, Rhythm only, the
// helpers (click level, Hear the chords), Reset mix and "Use as default", at 1440 and 1180, in
// Dark and Light and with increased contrast; and the phone mini-mixer (27 §3.7.2, Phone-Tools).
const VIEWPORTS = {
  desktop1440: {
    name: 'Desktop 1440',
    styles: { width: '1440px', height: '900px' },
    type: 'desktop',
  },
  desktop1180: {
    name: 'Desktop 1180',
    styles: { width: '1180px', height: '820px' },
    type: 'desktop',
  },
  phone390: { name: 'Phone 390', styles: { width: '390px', height: '844px' }, type: 'mobile' },
}
const meta = {
  title: 'Screens/Practice Mix',
  parameters: { layout: 'fullscreen', viewport: { options: VIEWPORTS } },
  beforeEach: () => {
    useMixerPrefs.setState({ defaults: {}, clickDb: 0 })
    usePracticeUi.setState({ hearChords: false })
  },
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const mixTab =
  (patch: Patch = {}) =>
  () => (
    <AppStory path={`/songs/${SONG_ID}/practice`} seed={seed(ALL, patch)}>
      <PracticePage songId={SONG_ID} search={{ tab: 'mix' }} fetchAudio={tone} />
    </AppStory>
  )

/** The Mix tab's panel once the stems play through the mixer. */
const mixPanel = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement)
  const panel = await canvas.findByRole('tabpanel', undefined, { timeout: 20_000 })
  await within(panel).findByRole('radiogroup', { name: 'Mix' }, { timeout: 20_000 })
  return { canvas, panel: within(panel), element: panel }
}

const rowNames = (panel: HTMLElement) =>
  [...panel.querySelectorAll('[data-slot=stem-row]')].map(
    (row) => row.querySelector('.truncate')?.textContent,
  )

/** Six stems: your part first and badged, then vocals, bass, drums, piano (Rough) and other. */
export const SixStems: Story = {
  render: mixTab({ stems: SIX_STEMS }),
  play: async ({ canvasElement }) => {
    const { panel, element } = await mixPanel(canvasElement)
    expect(rowNames(element)).toEqual(['Guitar', 'Vocals', 'Bass', 'Drums', 'Piano', 'Other'])
    const first = element.querySelector('[data-slot=stem-row]') as HTMLElement
    await expect(within(first).getByText('Your part')).toBeVisible()
    await expect(panel.getAllByRole('radio')).toHaveLength(4)
    await expect(panel.getByRole('radio', { name: /^Rhythm only/ })).toBeVisible()
    await expect(panel.queryByText('Band')).toBeNull()
    const piano = [...element.querySelectorAll('[data-slot=stem-row]')][4] as HTMLElement
    await expect(within(piano).getByText('Rough')).toBeVisible()
    for (const row of element.querySelectorAll('[data-slot=stem-ms]')) {
      const box = row.getBoundingClientRect()
      expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(48)
    }
  },
}

export const SixStemsAt1440: Story = {
  ...SixStems,
  globals: { viewport: { value: 'desktop1440' } },
}
export const SixStemsAt1180: Story = {
  ...SixStems,
  globals: { viewport: { value: 'desktop1180' } },
}
export const SixStemsLight: Story = { ...SixStems, globals: { appearance: 'light' } }
export const SixStemsIncreasedContrast: Story = { ...SixStems, globals: { contrast: 'more' } }
export const SixStemsLightIncreasedContrast: Story = {
  ...SixStems,
  globals: { appearance: 'light', contrast: 'more' },
}

/** The fixture's run (guitar, drums, other): no bass, so no Rhythm only; the drums are Rough. */
export const RoughStemNoRhythm: Story = {
  render: mixTab(),
  play: async ({ canvasElement }) => {
    const { panel, element } = await mixPanel(canvasElement)
    expect(rowNames(element)).toEqual(['Guitar', 'Drums', 'Other'])
    await expect(panel.queryByRole('radio', { name: /^Rhythm only/ })).toBeNull()
    const drums = [...element.querySelectorAll('[data-slot=stem-row]')][1] as HTMLElement
    await expect(within(drums).getByText('Rough')).toBeVisible()
    await expect(
      within(drums).getByText(/may contain bits of other instruments/, { selector: '.sr-only' }),
    ).toBeInTheDocument()
  },
}
export const RoughStemNoRhythmLight: Story = {
  ...RoughStemNoRhythm,
  globals: { appearance: 'light' },
}

/** Before s40a, or a run with only the target: your part and the Band (the mix-minus). */
export const TwoStemsFallback: Story = {
  render: mixTab({ stems: TWO_STEMS }),
  play: async ({ canvasElement }) => {
    const { panel, element } = await mixPanel(canvasElement)
    expect(rowNames(element)).toEqual(['Guitar', 'Band'])
    await expect(panel.getAllByRole('radio')).toHaveLength(3)
    const pill = within(canvasElement).getByRole('button', { name: /2 stems/ })
    await expect(pill).toBeVisible()
  },
}
export const TwoStemsFallbackLight: Story = {
  ...TwoStemsFallback,
  globals: { appearance: 'light' },
}

/** Solo: S filled, "solo" in the readout and its name; the tab gets its changed-mix dot. */
export const Soloed: Story = {
  render: mixTab({ stems: SIX_STEMS }),
  play: async ({ canvasElement }) => {
    const { canvas, panel } = await mixPanel(canvasElement)
    await expect(canvas.queryByRole('tab', { name: /Mix changed/ })).toBeNull()
    await userEvent.click(panel.getByRole('button', { name: 'Solo Bass' }))
    await expect(panel.getByRole('button', { name: 'Solo Bass' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(panel.getByRole('button', { name: 'Volume Bass: solo' })).toHaveTextContent('solo')
    await expect(canvas.getByRole('tab', { name: /Mix changed/ })).toBeVisible()
  },
}
export const SoloedLight: Story = { ...Soloed, globals: { appearance: 'light' } }

/** Muted (M or the key M): "muted" in the readout; Reset mix brings the default back. */
export const Muted: Story = {
  render: mixTab({ stems: SIX_STEMS }),
  play: async ({ canvasElement }) => {
    const { canvas, panel } = await mixPanel(canvasElement)
    await userEvent.click(panel.getByRole('button', { name: 'Mute Guitar' }))
    await expect(panel.getByRole('button', { name: 'Volume Guitar: muted' })).toHaveTextContent(
      'muted',
    )
    await userEvent.click(panel.getByRole('button', { name: 'Reset mix' }))
    await expect(panel.getByRole('button', { name: 'Mute Guitar' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await expect(canvas.queryByRole('tab', { name: /Mix changed/ })).toBeNull()
  },
}
export const MutedLight: Story = { ...Muted, globals: { appearance: 'light' } }

/** Rhythm only: bass and drums, the rest muted; the dock's pill names it. */
export const RhythmOnly: Story = {
  render: mixTab({ stems: SIX_STEMS }),
  globals: { viewport: { value: 'desktop1440' } },
  play: async ({ canvasElement }) => {
    const { canvas, panel } = await mixPanel(canvasElement)
    await userEvent.click(panel.getByRole('radio', { name: /^Rhythm only/ }))
    await expect(panel.getByRole('radio', { name: /^Rhythm only/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    for (const name of ['Guitar', 'Vocals', 'Piano', 'Other']) {
      await expect(panel.getByRole('button', { name: `Mute ${name}` })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
    }
    await expect(panel.getByRole('button', { name: 'Mute Bass' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await expect(canvas.getByRole('button', { name: /^Rhythm only/ })).toBeVisible()
  },
}
export const RhythmOnlyLight: Story = {
  ...RhythmOnly,
  globals: { appearance: 'light', viewport: { value: 'desktop1440' } },
}

/** Helpers: the click's level opens a stepper; Hear the chords switches the chord synth on. */
export const Helpers: Story = {
  render: mixTab({ stems: SIX_STEMS }),
  play: async ({ canvasElement }) => {
    const { panel } = await mixPanel(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(panel.getByRole('button', { name: 'Click level: 0 dB' }))
    await userEvent.click(await body.findByRole('button', { name: 'Louder Click' }))
    await waitFor(() => expect(useMixerPrefs.getState().clickDb).toBe(1))
    await userEvent.keyboard('{Escape}')
    const chords = panel.getByRole('switch', { name: 'Hear the chords' })
    await expect(chords).toHaveAccessibleDescription('A soft synth plays what we transcribed')
    await userEvent.click(chords)
    await expect(chords).toBeChecked()
    await expect(usePracticeUi.getState().hearChords).toBe(true)
  },
}
/** Hear the chords on: the chord synth loads and plays with the song (none in the story runner). */
export const HearChordsOn: Story = {
  render: mixTab({ stems: SIX_STEMS }),
  play: async ({ canvasElement }) => {
    const { panel } = await mixPanel(canvasElement)
    const chords = panel.getByRole('switch', { name: 'Hear the chords' })
    await userEvent.click(chords)
    await expect(chords).toBeChecked()
  },
}
export const HearChordsOnLight: Story = { ...HearChordsOn, globals: { appearance: 'light' } }

/** The guitar level in this device's guitar default. */
const GUITAR = 'guitar'
const guitarDefault = () => useMixerPrefs.getState().defaults[GUITAR]?.[GUITAR]

/** "Use as default for guitar": the mix becomes this device's start for guitar songs. */
export const UseAsDefault: Story = {
  render: mixTab({ stems: SIX_STEMS }),
  play: async ({ canvasElement }) => {
    const { canvas, panel } = await mixPanel(canvasElement)
    await userEvent.click(panel.getByRole('radio', { name: /^Minus-one/ }))
    await expect(canvas.getByRole('tab', { name: /Mix changed/ })).toBeVisible()
    await userEvent.click(panel.getByRole('button', { name: 'Use as default for guitar' }))
    await expect(guitarDefault()?.muted).toBe(true)
    await waitFor(() => expect(canvas.queryByRole('tab', { name: /Mix changed/ })).toBeNull())
  },
}

// The phone layout as its feature queries report it: portrait, ≤ 640 wide.
const phone = () => coarse({ '(max-width: 640px)': true, '(orientation: landscape)': false })

const openPhoneMix = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement)
  const button = await canvas.findByRole('button', { name: 'Mix' }, { timeout: 20_000 })
  await waitFor(() => expect(button).toBeEnabled(), { timeout: 20_000 })
  await userEvent.click(button)
  const body = within(canvasElement.ownerDocument.body)
  const sheet = await body.findByRole('dialog', { name: 'Mix' }, { timeout: 10_000 })
  await within(sheet).findByRole('group', { name: 'Mix' }, { timeout: 10_000 })
  return within(sheet)
}

const phoneScreen =
  (patch: Patch = {}) =>
  () => (
    <AppStory path={`/songs/${SONG_ID}/practice`} seed={seed(ALL, patch)}>
      <PracticePage songId={SONG_ID} search={{}} fetchAudio={tone} />
    </AppStory>
  )

/** The phone mini-mixer: preset chips, your part and the Band with an M painted 44, All 6 stems. */
export const PhoneMiniMixer: Story = {
  beforeEach: phone,
  render: phoneScreen({ stems: SIX_STEMS }),
  globals: { viewport: { value: 'phone390' } },
  play: async ({ canvasElement }) => {
    const sheet = await openPhoneMix(canvasElement)
    await expect(sheet.getByRole('button', { name: 'Rhythm only' })).toBeVisible()
    await expect(sheet.getByRole('slider', { name: 'Volume Guitar · your part' })).toBeVisible()
    const mute = sheet.getByRole('button', { name: 'Mute Band' })
    const box = mute.getBoundingClientRect()
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(48)
    await userEvent.click(mute)
    await expect(mute).toHaveAttribute('aria-pressed', 'true')
    await expect(sheet.getByText('· muted')).toBeVisible()
    await userEvent.click(sheet.getByRole('button', { name: 'All 6 stems' }))
    await expect(await sheet.findByRole('radiogroup', { name: 'Mix' })).toBeVisible()
    await expect(sheet.getByRole('button', { name: 'Mute Drums' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  },
}
export const PhoneMiniMixerLight: Story = {
  ...PhoneMiniMixer,
  globals: { appearance: 'light', viewport: { value: 'phone390' } },
}
export const PhoneMiniMixerIncreasedContrast: Story = {
  ...PhoneMiniMixer,
  globals: { contrast: 'more', viewport: { value: 'phone390' } },
}

/** The mini-mixer on a two-channel song: no Rhythm only chip, the Band is the mix-minus. */
export const PhoneMiniMixerFallback: Story = {
  beforeEach: phone,
  render: phoneScreen({ stems: TWO_STEMS }),
  globals: { viewport: { value: 'phone390' } },
  play: async ({ canvasElement }) => {
    const sheet = await openPhoneMix(canvasElement)
    await expect(sheet.queryByRole('button', { name: 'Rhythm only' })).toBeNull()
    await userEvent.click(sheet.getByRole('button', { name: 'Minus-one' }))
    await expect(sheet.getByRole('button', { name: 'Minus-one' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(sheet.getByRole('button', { name: 'All 2 stems' })).toBeVisible()
  },
}
