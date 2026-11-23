import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { m } from '@/lib/i18n'
import { AppStory } from '../../../.storybook/app.tsx'
import type { PracticeSearch } from './practice-context'
import { PracticePage } from './practice-page'
import { ALL, coarse, SONG_ID, seed, storyClip, tone } from './practice-story-data'

// The Loop tab (27 §3.7.4; s47 direction §3, §7) on the contracts' 8-bar fixture with bars 5–6
// looped: the loop's bars and its switch (L), Bars (From / To, the length 1 · 2 · 4 · 8 with
// ÷2 / ×2, moving it by its own length with Shift ← / →), Between repeats (rest, count-in with I,
// the pass question), the Speed ladder and Saved clips as hairline rows, docked at 1440, in the
// tablet drawer and the phone sheet, in Dark and Light.
const VIEWPORTS = {
  desktop1440: {
    name: 'Desktop 1440',
    styles: { width: '1440px', height: '900px' },
    type: 'desktop',
  },
  phone375: { name: 'Phone 375', styles: { width: '375px', height: '812px' }, type: 'mobile' },
}
const meta = {
  title: 'Screens/Practice Loop',
  parameters: { layout: 'fullscreen', viewport: { options: VIEWPORTS } },
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const CHORUS = storyClip(1, 'Chorus riff', 5, 6, { best_clean_tempo_pct: 80 })
const BRIDGE = storyClip(2, 'Bridge bends', 3, 4, { best_clean_tempo_pct: 65 })

const screen = (search: PracticeSearch) => () => (
  <AppStory path={`/songs/${SONG_ID}/practice`} seed={seed(ALL, { clips: [CHORUS, BRIDGE] })}>
    <PracticePage songId={SONG_ID} search={search} fetchAudio={tone} />
  </AppStory>
)

/** `?tab=loop` opens the panel on the Loop tab (27 §3.7.1): Tools (X) shows it open. */
const loopTab = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement)
  await waitFor(() => expect(canvas.getByRole('button', { name: 'Play' })).toBeEnabled(), {
    timeout: 20_000,
  })
  const tools = canvas
    .getByRole('toolbar', { name: 'Playback' })
    .querySelector<HTMLElement>('[aria-keyshortcuts="X"]')
  if (!tools) throw new Error('No Tools in the transport')
  await expect(tools).toHaveAttribute('aria-pressed', 'true')
  const panel = await within(canvasElement.ownerDocument.body).findByRole('tabpanel')
  // The tab's body loads when it is first shown.
  await within(panel).findByRole('heading', { name: /^Bars / }, { timeout: 15_000 })
  return within(panel)
}

/** The loop switch carries L; the length, the move and the count-in act at once. */
export const Docked: Story = {
  render: screen({ tab: 'loop' }),
  globals: { viewport: { value: 'desktop1440' } },
  play: async ({ canvasElement }) => {
    const panel = await loopTab(canvasElement)
    await expect(panel.getByRole('heading', { name: 'Bars 5–6' })).toBeVisible()
    const loop = panel.getByRole('button', { name: 'Loop' })
    await expect(loop).toHaveAttribute('aria-keyshortcuts', 'L')
    await expect(loop).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(loop)
    await expect(loop).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(loop)
    // The length it has is marked with the ink edge; 4 bars keeps the start.
    await expect(panel.getByRole('button', { name: '2-bar loop' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await userEvent.click(panel.getByRole('button', { name: '4-bar loop' }))
    await expect(await panel.findByRole('heading', { name: 'Bars 5–8' })).toBeVisible()
    await userEvent.click(panel.getByRole('button', { name: 'Halve the loop' }))
    await expect(await panel.findByRole('heading', { name: 'Bars 5–6' })).toBeVisible()
    // Back by its own length, as Shift ← does.
    const earlier = panel.getByRole('button', { name: m['practice.loop_move_back']() })
    await expect(earlier).toHaveAttribute('aria-keyshortcuts', '⇧←')
    await userEvent.click(earlier)
    await expect(await panel.findByRole('heading', { name: 'Bars 3–4' })).toBeVisible()
    // Count-in: one of three, the key I printed beside it.
    const countIn = panel.getByRole('group', { name: m['settings.count_in']() })
    await expect(countIn).toHaveAttribute('aria-keyshortcuts', 'I')
    await userEvent.click(within(countIn).getByRole('button', { name: '2 bars' }))
    await expect(within(countIn).getByRole('button', { name: '2 bars' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(panel.getByRole('switch', { name: m['practice.ask_after_pass']() })).toBeVisible()
  },
}
export const DockedLight: Story = {
  ...Docked,
  globals: { appearance: 'light', viewport: { value: 'desktop1440' } },
}

/** Saved clips are hairline rows: the one playing has the ink edge and is the current item; a
 * row loops its clip; Rename and Delete sit in its ⋯ menu. */
export const SavedClips: Story = {
  render: screen({ tab: 'loop' }),
  play: async ({ canvasElement }) => {
    const panel = await loopTab(canvasElement)
    const chorus = panel.getByRole('button', { name: /^Chorus riff/ })
    await expect(chorus).toHaveAttribute('aria-current', 'true')
    await expect(chorus.closest('[data-slot=list-row]')).toHaveAttribute('data-current', 'true')
    await expect(panel.getByRole('button', { name: 'More for Bridge bends' })).toBeVisible()
    await userEvent.click(panel.getByRole('button', { name: /^Bridge bends/ }))
    await expect(await panel.findByRole('heading', { name: 'Bars 3–4' })).toBeVisible()
    await waitFor(() =>
      expect(panel.getByRole('button', { name: /^Bridge bends/ })).toHaveAttribute(
        'aria-current',
        'true',
      ),
    )
  },
}
export const SavedClipsLight: Story = { ...SavedClips, globals: { appearance: 'light' } }

/** On a phone the same tab is in the Tools sheet above the transport; nothing spills sideways. */
export const PhoneSheet: Story = {
  beforeEach: () => coarse({ '(max-width: 640px)': true, '(orientation: landscape)': false }),
  render: screen({ tab: 'loop' }),
  globals: { viewport: { value: 'phone375' } },
  play: async ({ canvasElement }) => {
    const panel = await loopTab(canvasElement)
    const sheet = (await within(canvasElement.ownerDocument.body).findByRole('dialog', {
      name: m['practice.tools_label'](),
    })) as HTMLElement
    await expect(panel.getByRole('button', { name: '4-bar loop' })).toBeVisible()
    expect(sheet.scrollWidth).toBeLessThanOrEqual(sheet.clientWidth + 1)
    const transport = within(canvasElement).getByRole('toolbar', { name: 'Playback' })
    // Once the sheet has slid in, it stops above the transport.
    await waitFor(() =>
      expect(sheet.getBoundingClientRect().bottom).toBeLessThanOrEqual(
        transport.getBoundingClientRect().top + 2,
      ),
    )
  },
}
export const PhoneSheetLight: Story = {
  ...PhoneSheet,
  globals: { appearance: 'light', viewport: { value: 'phone375' } },
}
