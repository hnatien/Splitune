import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  MetronomeIcon,
  PauseIcon,
  PlayIcon,
  RepeatIcon,
  RotateCcwIcon,
  SkipBackIcon,
  SkipForwardIcon,
  SlidersVerticalIcon,
} from 'lucide-react'
import { useState } from 'react'
import { expect, fireEvent, fn, userEvent, waitFor, within } from 'storybook/test'
import { Button } from './button.tsx'
import {
  COPY,
  contrastRatio,
  inkEdgeOf,
  insetRings,
  rgbOf,
  sameColour,
  surfaceOf,
  tokenColour,
} from './fixtures.ts'
import { CountInIcon } from './icons/index.tsx'
import { LoopBadge } from './loop-badge.tsx'
import { PassControl } from './pass-control.tsx'
import { PedalHud } from './pedal-hud.tsx'
import { SpeedControl } from './speed-control.tsx'
import { expectTargets, StateGrid } from './story-kit.tsx'
import { TransportButton } from './transport-button.tsx'

// The practice transport as the s47 direction sets it (§6): the transport keys and Play (the one
// filled control, 64 px) with the bar readout on the left; the loop toggle and the loop line in
// the centre, replaced by the pass prompt after a looped pass; count-in, speed and Mix on the
// right. Every other control is a quiet 48 px circle or pill, each with its key cap on fine
// pointers. On a phone the groups wrap into rows and the key caps go.
const meta = { title: 'Kit/Transport' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const VIEWPORTS = {
  viewport: {
    options: {
      phone: { name: 'Phone 375', styles: { width: '375px', height: '812px' }, type: 'mobile' },
      wide: { name: 'Wide', styles: { width: '1600px', height: '900px' }, type: 'desktop' },
    },
  },
}
const PHONE = { viewport: { value: 'phone', isRotated: false }, pointer: 'coarse' } as const
// Inline presets show from 2xl (1536 px), wider than any of the addon's own viewports.
const WIDE = { viewport: { value: 'wide', isRotated: false } } as const
const TABLET = { viewport: { value: 'tablet', isRotated: false } } as const

const SPEED_LABELS = {
  speed: 'Speed',
  decrease: 'Slower',
  increase: 'Faster',
  presets: 'Speed presets',
  field: 'Speed in percent',
}

type TransportProps = {
  /** A looped pass just ended: the pass prompt takes the loop line's place. */
  prompting?: boolean
  stems?: boolean
  onClean?: () => void
}

function Transport({ prompting = false, stems = true, onClean = fn() }: TransportProps) {
  const [playing, setPlaying] = useState(false)
  const [loopOn, setLoopOn] = useState(true)
  const [countIn, setCountIn] = useState(true)
  const [mix, setMix] = useState(false)
  const [speed, setSpeed] = useState(70)
  return (
    <div
      data-slot="transport"
      data-density="practice"
      className="flex w-full max-w-full flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border bg-background py-2"
    >
      <fieldset aria-label="Position" className="m-0 flex items-center gap-1 border-0 p-0">
        <TransportButton
          icon={<RotateCcwIcon aria-hidden />}
          label="From the top"
          showLabel={false}
          shortcut="R"
        />
        <TransportButton
          icon={<SkipBackIcon aria-hidden />}
          label="Previous bar"
          showLabel={false}
          shortcut="←"
        />
        <TransportButton
          tone="primary"
          icon={playing ? <PauseIcon aria-hidden /> : <PlayIcon aria-hidden />}
          label={playing ? 'Pause' : 'Play'}
          shortcut="Space"
          onClick={() => setPlaying(!playing)}
        />
        <TransportButton
          icon={<SkipForwardIcon aria-hidden />}
          label="Next bar"
          showLabel={false}
          shortcut="→"
        />
        <p data-slot="bar-readout" className="m-0 ml-2 w-24 text-title tabular-nums max-md:hidden">
          Bar 6.3 <span className="text-muted-foreground">/ 24</span>
          <span className="block text-caption text-muted-foreground">0:13 / 0:58</span>
        </p>
      </fieldset>
      <div
        data-slot="loop-line"
        className="flex min-w-0 flex-[1_1_18rem] items-center justify-center gap-1"
      >
        {prompting ? (
          <PassControl
            prompting
            className="w-full justify-center"
            question="How was pass 3?"
            labels={{ prompt: COPY.passPrompt, clean: COPY.feltClean, notYet: COPY.notYet }}
            shortcuts={{ clean: 'C', notYet: 'N' }}
            onClean={onClean}
            onNotYet={fn()}
          />
        ) : (
          <>
            <TransportButton
              icon={<RepeatIcon aria-hidden />}
              label="Loop"
              showLabel={false}
              shortcut="L"
              pressed={loopOn}
              onPressedChange={setLoopOn}
            />
            <LoopBadge
              state={loopOn ? 'active' : 'off'}
              detail="pass 3 · rest 1 beat"
              className="min-w-0 shrink"
            >
              {loopOn ? 'Bars 5–8 · 70 %' : 'No loop · tap two bars'}
            </LoopBadge>
          </>
        )}
      </div>
      <fieldset aria-label="Practice helpers" className="m-0 flex items-center gap-1 border-0 p-0">
        <TransportButton
          icon={<CountInIcon aria-hidden />}
          label="Count-in"
          detail="1 bar"
          showLabel="wide"
          shortcut="I"
          pressed={countIn}
          onPressedChange={setCountIn}
        />
        <SpeedControl
          value={speed}
          onValueChange={setSpeed}
          bpm={100}
          compact
          inlinePresets={false}
          labels={SPEED_LABELS}
          shortcuts={{ decrease: ',', increase: '.', open: 'S' }}
        />
        <TransportButton
          icon={<SlidersVerticalIcon aria-hidden />}
          label="Mix"
          detail="Your part loud"
          showLabel="wide"
          shortcut="X"
          pressed={mix && stems}
          disabled={!stems}
          unavailableLabel="Unavailable · after your part is isolated"
          onPressedChange={setMix}
        />
      </fieldset>
    </div>
  )
}

/** The readout's printed number ("70 %"), without its spoken name. */
const shownSpeed = (canvasElement: HTMLElement) =>
  within(canvasElement)
    .getByRole('button', { name: /^Speed: / })
    .querySelector('[aria-hidden]')?.textContent ?? ''

/** A transport control's printed label, beside its icon. */
const printedLabel = (control: HTMLElement) =>
  control.querySelector<HTMLElement>('[data-slot=transport-label]')

const controls = (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLElement>('button')].filter(
    (button) => button.getAttribute('aria-hidden') !== 'true',
  )

/** Doc 26 §8: Play is the 64 px circle; every other control is at least 48 × 48. */
export const Targets: Story = {
  render: () => <Transport />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const play = canvas.getByRole('button', { name: 'Play' })
    const box = play.getBoundingClientRect()
    await expect([Math.round(box.width), Math.round(box.height)]).toEqual([64, 64])
    await expect(getComputedStyle(play).borderTopLeftRadius).not.toBe('0px')
    await expectTargets(
      controls(canvasElement).filter((button) => button !== play),
      48,
    )
  },
}

/** One filled control: Play is the ink; every other control has no fill at rest. */
export const OneFilledControl: Story = {
  render: () => <Transport />,
  globals: { appearance: 'light' },
  play: async ({ canvasElement }) => {
    const filled = controls(canvasElement).filter(
      (button) => (rgbOf(getComputedStyle(button).backgroundColor)[3] ?? 0) > 0,
    )
    const play = within(canvasElement).getByRole('button', { name: 'Play' })
    await expect(filled).toEqual([play])
    await expect(
      sameColour(getComputedStyle(play).backgroundColor, tokenColour('--primary', play)),
    ).toBe(true)
  },
}

/** Every control with a key prints its key cap on fine pointers and names it to assistive tech. */
export const KeyCaps: Story = {
  render: () => <Transport />,
  play: async ({ canvasElement }) => {
    const keyed = [...canvasElement.querySelectorAll<HTMLElement>('[aria-keyshortcuts]')]
    await expect(keyed.map((control) => control.getAttribute('aria-keyshortcuts'))).toEqual([
      'R',
      '←',
      'Space',
      '→',
      'L',
      'I',
      ',',
      'S',
      '.',
      'X',
    ])
    for (const control of keyed) {
      const cap = control.querySelector('kbd')
      await expect(cap).toBeVisible()
      await expect(cap).toHaveTextContent(control.getAttribute('aria-keyshortcuts') ?? '')
    }
  },
}

/** Coarse pointers hide the key caps; the keys still work, so the names keep them. */
export const KeyCapsHiddenOnTouch: Story = {
  render: () => <Transport />,
  globals: { pointer: 'coarse' },
  play: async ({ canvasElement }) => {
    const caps = [...canvasElement.querySelectorAll('kbd')]
    await expect(caps.length).toBeGreaterThan(0)
    for (const cap of caps) await expect(cap).not.toBeVisible()
    await expect(within(canvasElement).getByRole('button', { name: 'Play' })).toHaveAttribute(
      'aria-keyshortcuts',
      'Space',
    )
  },
}

/** "On" is the 1.5 px ink edge (≥ 3:1 against the bar) with aria-pressed, never a grey fill. */
export const OnIsAnInkEdge: Story = {
  render: () => <Transport />,
  globals: { appearance: 'light' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const name of ['Loop', 'Count-in']) {
      const toggle = canvas.getByRole('button', { name })
      await expect(toggle).toHaveAttribute('aria-pressed', 'true')
      await waitFor(async () => {
        const edge = inkEdgeOf(toggle)
        await expect(edge.width).toBe(1.5)
        await expect(edge.contrast).toBeGreaterThanOrEqual(3)
        await expect(edge.fill).toBe(0)
      })
    }
    const loop = canvas.getByRole('button', { name: 'Loop' })
    await userEvent.click(loop)
    await userEvent.unhover(loop)
    await expect(loop).toHaveAttribute('aria-pressed', 'false')
    await waitFor(() => expect(inkEdgeOf(loop).width).toBe(0))
    // The loop line says it too: off is a hairline and muted words, active the ink edge.
    await expect(canvas.getByRole('button', { name: /^No loop/ })).toHaveAttribute(
      'data-state',
      'off',
    )
  },
}
export const OnIsAnInkEdgeDark: Story = { ...OnIsAnInkEdge, globals: { appearance: 'dark' } }

/** Disabled: faint text inside a ≥ 3:1 edge, no fill, never faded, and the reason in its name. */
export const Unavailable: Story = {
  render: () => <Transport stems={false} />,
  globals: { appearance: 'light' },
  play: async ({ canvasElement }) => {
    const mix = within(canvasElement).getByRole('button', {
      name: 'Mix, Unavailable · after your part is isolated',
    })
    await expect(mix).toBeDisabled()
    const style = getComputedStyle(mix)
    await expect(style.opacity).toBe('1')
    await expect(rgbOf(style.backgroundColor)[3]).toBe(0)
    await expect(sameColour(style.color, tokenColour('--faint-foreground', mix))).toBe(true)
    // A dashed edge, never the solid ring that marks "on".
    await expect(style.outlineStyle).toBe('dashed')
    await expect(sameColour(style.outlineColor, tokenColour('--edge', mix))).toBe(true)
    const ring = insetRings(mix).find((r) => sameColour(r.colour, tokenColour('--edge', mix)))
    await expect(ring).toBeUndefined()
    await expect(contrastRatio(tokenColour('--edge', mix), surfaceOf(mix))).toBeGreaterThanOrEqual(
      3,
    )
  },
}
export const UnavailableDark: Story = { ...Unavailable, globals: { appearance: 'dark' } }

/** The speed readout keeps its width from 50 to 100 %, so nothing beside it moves. */
export const NumbersHoldTheirWidth: Story = {
  render: () => <Transport />,
  globals: { motion: 'reduce' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const readout = canvas.getByRole('button', { name: /^Speed: / })
    const widths = new Set<number>()
    const press = async (name: string, times: number) => {
      for (let i = 0; i < times; i++) {
        await userEvent.click(canvas.getByRole('button', { name }))
        widths.add(readout.getBoundingClientRect().width)
      }
    }
    await press('Faster', 6)
    await waitFor(() => expect(shownSpeed(canvasElement)).toMatch(/^100/))
    await press('Slower', 10)
    await waitFor(() => expect(shownSpeed(canvasElement)).toMatch(/^50/))
    await expect([...widths]).toHaveLength(1)
    const number = readout.querySelector('[aria-hidden] > span') as HTMLElement
    await expect(getComputedStyle(number).fontVariantNumeric).toContain('tabular-nums')
    await expect(
      getComputedStyle(number.nextElementSibling as Element).fontVariantNumeric,
    ).toContain('tabular-nums')
  },
}

/** The readout opens the speed panel: presets with the current one edged, and a typed field. */
export const SpeedPanelTyped: Story = {
  render: () => <Transport />,
  globals: { motion: 'reduce' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /^Speed: 70/ }))
    const body = within(canvasElement.ownerDocument.body)
    const panel = await body.findByRole('dialog', { name: 'Speed' })
    const presets = within(panel).getByRole('group', { name: 'Speed presets' })
    const seventy = within(presets).getByRole('button', { name: /^70/ })
    await expect(seventy).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(inkEdgeOf(seventy).width).toBe(1.5))
    // The field has focus on open, so a number and Enter set the speed.
    const field = within(panel).getByRole('textbox', { name: 'Speed in percent' })
    await waitFor(() => expect(field).toHaveFocus())
    await userEvent.clear(field)
    await userEvent.type(field, '65{Enter}')
    await waitFor(() => expect(shownSpeed(canvasElement)).toMatch(/^65/))
    // Enter closes the panel; a preset sets the speed from it as well.
    await waitFor(() => expect(body.queryByRole('dialog', { name: 'Speed' })).toBeNull())
    await userEvent.click(canvas.getByRole('button', { name: /^Speed: 65/ }))
    const again = await body.findByRole('dialog', { name: 'Speed' })
    await userEvent.click(within(again).getByRole('button', { name: /^80/ }))
    await expect(canvas.getByRole('button', { name: /^Speed: 80/ })).toBeInTheDocument()
  },
}

export const KeyboardSpeed: Story = {
  render: () => <Transport />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Faster' }))
    await expect(canvas.getByRole('button', { name: /^Speed: 75/ })).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Faster' }))
    fireEvent.click(canvas.getByRole('button', { name: 'Slower' }), { shiftKey: true })
    await expect(canvas.getByRole('button', { name: /^Speed: 79/ })).toBeInTheDocument()
    // The number counts up to it; the accessibility check waits for it to settle.
    await waitFor(() => expect(shownSpeed(canvasElement)).toMatch(/^79/))
  },
}

/** The speed number counts to the new value; the name states it at once. */
export const SpeedTween: Story = {
  render: () => <Transport />,
  globals: { motion: 'full' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Faster' }))
    await expect(canvas.getByRole('button', { name: /^Speed: 75/ })).toBeInTheDocument()
    await waitFor(() => expect(shownSpeed(canvasElement)).toMatch(/^75/))
  },
}
export const SpeedJumpsUnderReducedMotion: Story = {
  render: () => <Transport />,
  globals: { motion: 'reduce' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Faster' }))
    await waitFor(() => expect(shownSpeed(canvasElement)).toMatch(/^75/))
  },
}

/** Labelled groups: position, the loop line and the helpers. */
export const Groups: Story = {
  render: () => <Transport />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const position = canvas.getByRole('group', { name: 'Position' })
    const names = ['From the top', 'Previous bar', 'Play', 'Next bar']
    const buttons = within(position).getAllByRole('button')
    await expect(buttons).toHaveLength(names.length)
    for (const [index, name] of names.entries()) {
      await expect(buttons[index]).toHaveAccessibleName(name)
    }
    await expect(canvas.getByRole('button', { name: /^Bars 5–8 · 70\s%/ })).toBeVisible()
    const helpers = canvas.getByRole('group', { name: 'Practice helpers' })
    await expect(within(helpers).getAllByRole('button')).toHaveLength(5)
  },
}

/** The icon swaps between Play and Pause; the name stays exactly one of the two. */
export const PlayPause: Story = {
  render: () => <Transport />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Play' }))
    await expect(canvas.getByRole('button', { name: 'Pause' })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Play' })).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Pause' }))
    await expect(canvas.getByRole('button', { name: 'Play' })).toBeVisible()
  },
}

/** At the stand the helpers show their labels beside the icon; the transport keys stay icons. */
export const LabelsAtTheStand: Story = {
  render: () => <Transport />,
  globals: { distance: 'stand' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const countIn = printedLabel(canvas.getByRole('button', { name: 'Count-in' }))
    await expect(countIn).toBeVisible()
    await expect(countIn).toHaveTextContent('Count-in1 bar')
    await expect(printedLabel(canvas.getByRole('button', { name: 'Next bar' }))).toBeNull()
  },
}

/** Wide screens label the helpers at desk distance too; the transport keys stay icons (26 §11). */
export const LabelsWhenWide: Story = {
  render: () => <Transport />,
  parameters: VIEWPORTS,
  globals: WIDE,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const name of ['Count-in', 'Mix']) {
      await expect(printedLabel(canvas.getByRole('button', { name }))).toBeVisible()
    }
    await expect(printedLabel(canvas.getByRole('button', { name: 'Previous bar' }))).toBeNull()
  },
}

/** After a looped pass the pass prompt takes the loop line's place, its answers 48 px with keys. */
const onClean = fn()
export const PassPromptReplacesLoopLine: Story = {
  render: () => <Transport prompting onClean={onClean} />,
  play: async ({ canvasElement }) => {
    onClean.mockClear()
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('button', { name: /^Bars 5–8/ })).toBeNull()
    const prompt = canvas.getByRole('group', { name: 'How was pass 3?' })
    const answers = within(prompt).getAllByRole('button')
    // Left means again, right means go: Not yet before Felt clean, as the pedal reads them.
    await expect(answers[0]).toHaveAccessibleName(/^Not yet/)
    await expect(answers[1]).toHaveAccessibleName(/^Felt clean/)
    await expect(answers.map((answer) => answer.querySelector('kbd')?.textContent)).toEqual([
      'N',
      'C',
    ])
    await expectTargets(answers, 48)
    for (const answer of answers) {
      await expect(rgbOf(getComputedStyle(answer).backgroundColor)[3]).toBe(0)
    }
    await userEvent.click(within(prompt).getByRole('button', { name: /Felt clean/ }))
    await expect(onClean).toHaveBeenCalledTimes(1)
  },
}
export const PassPromptReplacesLoopLineDark: Story = {
  render: () => <Transport prompting />,
  globals: { appearance: 'dark' },
}

/** 375 px with a touch pointer: the groups wrap into rows, nothing overflows or is clipped, the
 * targets hold, and the key caps go. */
const fitsOnAPhone: NonNullable<Story['play']> = async ({ canvasElement }) => {
  const transport = canvasElement.querySelector<HTMLElement>('[data-slot=transport]')
  if (!transport) throw new Error('no transport')
  await expect(transport.getBoundingClientRect().width).toBeLessThanOrEqual(375)
  await expect(transport.scrollWidth).toBeLessThanOrEqual(transport.clientWidth)
  const edge = transport.getBoundingClientRect()
  const outside: string[] = []
  for (const control of controls(transport)) {
    const box = control.getBoundingClientRect()
    if (box.left < edge.left - 0.5 || box.right > edge.right + 0.5) {
      outside.push(control.textContent ?? '')
    }
    // Nothing inside a control is cut off either.
    await expect(control.scrollWidth).toBeLessThanOrEqual(control.clientWidth + 1)
  }
  await expect(outside).toEqual([])
  const play = within(transport).getByRole('button', { name: 'Play' })
  const box = play.getBoundingClientRect()
  await expect([Math.round(box.width), Math.round(box.height)]).toEqual([64, 64])
  await expectTargets(
    controls(transport).filter((control) => control !== play),
    48,
  )
  for (const cap of transport.querySelectorAll('kbd')) await expect(cap).not.toBeVisible()
}
export const Phone: Story = {
  render: () => <Transport />,
  parameters: { ...VIEWPORTS, layout: 'fullscreen' },
  globals: { ...PHONE, appearance: 'light' },
  play: fitsOnAPhone,
}
export const PhoneDark: Story = { ...Phone, globals: { ...PHONE, appearance: 'dark' } }

/** On a phone the question takes its own row above the two answers. */
export const PhonePassPrompt: Story = {
  render: () => <Transport prompting />,
  parameters: { ...VIEWPORTS, layout: 'fullscreen' },
  globals: { ...PHONE, appearance: 'light' },
  play: async (context) => {
    await fitsOnAPhone(context)
    const prompt = within(context.canvasElement).getByRole('group', { name: 'How was pass 3?' })
    const question = prompt.querySelector('[data-slot=pass-question]') as HTMLElement
    // The prompt fades in (26 §10).
    await waitFor(() => expect(question).toBeVisible())
    await expect(question.scrollWidth).toBeLessThanOrEqual(question.clientWidth)
    const answer = within(prompt).getByRole('button', { name: /Not yet/ })
    await expect(question.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      answer.getBoundingClientRect().top + 1,
    )
  },
}
export const PhonePassPromptDark: Story = {
  ...PhonePassPrompt,
  globals: { ...PHONE, appearance: 'dark' },
}

const onSpeed = fn()
const onSpeedOpen = fn()

/** The `S` key opens the panel by its `open` prop: the typed field has focus with its text
 * selected, so "70" and Enter set the speed and close the panel. */
function SpeedByKey() {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(85)
  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" onClick={() => setOpen(true)}>
        Press S
      </Button>
      <SpeedControl
        value={value}
        onValueChange={(next) => {
          onSpeed(next)
          setValue(next)
        }}
        open={open}
        onOpenChange={(next) => {
          onSpeedOpen(next)
          setOpen(next)
        }}
        bpm={100}
        inlinePresets={false}
        labels={SPEED_LABELS}
        shortcuts={{ decrease: ',', increase: '.', open: 'S' }}
      />
    </div>
  )
}
export const SpeedOpenedByKey: Story = {
  render: () => <SpeedByKey />,
  globals: { motion: 'reduce' },
  play: async ({ canvasElement }) => {
    onSpeed.mockClear()
    onSpeedOpen.mockClear()
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Press S' }))
    const body = within(canvasElement.ownerDocument.body)
    const panel = await body.findByRole('dialog', { name: 'Speed' })
    const field = within(panel).getByRole('textbox', {
      name: 'Speed in percent',
    }) as HTMLInputElement
    await waitFor(() => expect(field).toHaveFocus())
    await waitFor(() => {
      expect(field.selectionStart).toBe(0)
      expect(field.selectionEnd).toBe(field.value.length)
    })
    await expect(field.value).toBe('85')
    await userEvent.keyboard('70{Enter}')
    await expect(onSpeed).toHaveBeenLastCalledWith(70)
    await waitFor(() => expect(body.queryByRole('dialog', { name: 'Speed' })).toBeNull())
    await expect(onSpeedOpen).toHaveBeenLastCalledWith(false)
    await waitFor(() => expect(shownSpeed(canvasElement)).toMatch(/^70/))
  },
}

/** From `2xl` the presets sit inline, the current speed edged; the readout keeps the panel. */
export const InlinePresets: Story = {
  render: () => (
    <SpeedControl
      value={70}
      onValueChange={fn()}
      bpm={100}
      labels={SPEED_LABELS}
      shortcuts={{ decrease: ',', increase: '.' }}
    />
  ),
  globals: WIDE,
  parameters: VIEWPORTS,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const presets = await canvas.findByRole('group', { name: 'Speed presets' }, { timeout: 10_000 })
    const seventy = within(presets).getByRole('button', { name: /^70/ })
    await expect(seventy).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(inkEdgeOf(seventy).width).toBe(1.5))
    await expect(within(presets).getByRole('button', { name: /^80/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  },
}

/** Below `2xl` there are no inline presets: the readout's panel has them. */
export const NoInlinePresetsOnTablets: Story = {
  render: () => <SpeedControl value={70} onValueChange={fn()} bpm={100} labels={SPEED_LABELS} />,
  globals: TABLET,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('group', { name: 'Speed presets' })).toBeNull()
  },
}

/** The loop line's four states, told apart by edge, icon and words, never by a fill. */
const LoopBadges = () => (
  <StateGrid
    states={[
      [
        'Off',
        <LoopBadge key="off" state="off" detail="tap two bars, or a section">
          No loop
        </LoopBadge>,
      ],
      [
        'Armed',
        <LoopBadge key="armed" state="armed" detail="tap the last bar">
          From bar 5
        </LoopBadge>,
      ],
      [
        'Active',
        <LoopBadge key="active" state="active" detail="pass 3 · rest 1 beat" shortcut="L">
          Bars 5–8 · 70 %
        </LoopBadge>,
      ],
      [
        'Resting',
        <LoopBadge key="resting" state="resting" detail="rest 1 beat">
          Bars 5–8 · 70 %
        </LoopBadge>,
      ],
    ]}
  />
)
export const LoopBadgeStates: Story = {
  render: LoopBadges,
  globals: { appearance: 'light' },
  play: async ({ canvasElement }) => {
    const badge = (state: string) =>
      canvasElement.querySelector<HTMLElement>(
        `[data-slot=loop-badge][data-state=${state}]`,
      ) as HTMLElement
    for (const state of ['off', 'armed', 'active', 'resting']) {
      const box = badge(state).getBoundingClientRect()
      await expect(box.height).toBeGreaterThanOrEqual(48)
      await expect(rgbOf(getComputedStyle(badge(state)).backgroundColor)[3]).toBe(0)
    }
    await expect(inkEdgeOf(badge('active')).width).toBe(1.5)
    await expect(inkEdgeOf(badge('active')).contrast).toBeGreaterThanOrEqual(3)
    await expect(inkEdgeOf(badge('off')).width).toBe(0)
    const armed = getComputedStyle(badge('armed'))
    await expect(armed.borderStyle).toBe('dashed')
    await expect(sameColour(armed.borderTopColor, tokenColour('--selected', badge('armed')))).toBe(
      true,
    )
    await expect(badge('resting').querySelector('.lucide-pause')).not.toBeNull()
    await expect(within(badge('active')).getByText('L')).toBeVisible()
  },
}
export const LoopBadgeStatesDark: Story = { ...LoopBadgeStates, globals: { appearance: 'dark' } }

function NewBest() {
  const [best, setBest] = useState(70)
  return (
    <PassControl
      labels={{ prompt: COPY.passPrompt, clean: COPY.feltClean, notYet: COPY.notYet }}
      best={`Best clean pass: ${best} %`}
      shortcuts={{ clean: 'C', notYet: 'N' }}
      onClean={() => setBest(85)}
      onNotYet={fn()}
    />
  )
}

/** A new best draws a tick before it; the best a song opens with has none. */
export const PassNewBest: Story = {
  render: () => <NewBest />,
  play: async ({ canvasElement }) => {
    const tick = () => canvasElement.querySelector('.lucide-check-draw')
    await expect(tick()).toBeNull()
    await userEvent.click(within(canvasElement).getByRole('button', { name: /Felt clean/ }))
    await waitFor(() => expect(tick()).not.toBeNull())
    await expect(within(canvasElement).getByText('Best clean pass: 85 %')).toBeVisible()
  },
}

/** Inline, a pass waiting for its answer shows the question before the pair and names the group. */
export const PassPrompting: Story = {
  render: () => (
    <PassControl
      prompting
      question="How was pass 2?"
      labels={{ prompt: COPY.passPrompt, clean: COPY.feltClean, notYet: COPY.notYet }}
      best={COPY.bestTempo}
      shortcuts={{ clean: 'C', notYet: 'N' }}
      onClean={fn()}
      onNotYet={fn()}
    />
  ),
  play: async ({ canvasElement }) => {
    const group = within(canvasElement).getByRole('group', { name: 'How was pass 2?' })
    await expect(group).toHaveAttribute('data-prompting')
    // The question fades in (26 §10), in place of the best tempo.
    await waitFor(() => expect(group.querySelector('[data-slot=pass-question]')).toBeVisible())
    await expect(within(group).queryByText(COPY.bestTempo)).toBeNull()
  },
}

/** A hidden slot: the pair keeps its room, out of the pointer's and the keyboard's reach. */
export const PassSlotReserved: Story = {
  render: () => (
    <PassControl
      className="invisible"
      inert
      labels={{ prompt: COPY.passPrompt, clean: COPY.feltClean, notYet: COPY.notYet }}
      onClean={fn()}
      onNotYet={fn()}
    />
  ),
  play: async ({ canvasElement }) => {
    const pass = canvasElement.querySelector<HTMLElement>('[data-slot=pass-control]')
    await expect(pass).not.toBeVisible()
    await expect(pass).toHaveAttribute('inert')
    await expect(pass?.getBoundingClientRect().width).toBeGreaterThan(0)
    await expect(within(canvasElement).queryByRole('button', { name: /Felt clean/ })).toBeNull()
  },
}

/** Phones may show the answers as icons; their names stay the words. */
export const PassCompact: Story = {
  render: () => (
    <PassControl
      compact
      labels={{ prompt: COPY.passPrompt, clean: COPY.feltClean, notYet: COPY.notYet }}
      onClean={fn()}
      onNotYet={fn()}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expectTargets(
      [
        canvas.getByRole('button', { name: COPY.notYet }),
        canvas.getByRole('button', { name: COPY.feltClean }),
      ],
      48,
    )
  },
}

function HudDemo() {
  const [sequence, setSequence] = useState(1)
  return (
    <div className="flex max-w-xl flex-col gap-3">
      <div data-slot="status-row" className="flex h-12 items-center justify-between gap-3">
        <button type="button" onClick={() => setSequence(sequence + 1)}>
          Again
        </button>
        <PedalHud message="Loop bars 5–8" source="Key 4" sequence={sequence} />
      </div>
      <div
        data-slot="notation"
        className="grid h-40 place-items-center rounded-media bg-paper text-caption text-faint-foreground"
      >
        Notation
      </div>
    </div>
  )
}

/** One quiet line, "Key 4 · Loop bars 5–8", on --raised with a hairline, outside the music. Each
 * press pops it in again, even with the same text. */
export const PedalHudLine: Story = {
  render: () => <HudDemo />,
  globals: { appearance: 'light' },
  play: async ({ canvasElement }) => {
    const hud = () => canvasElement.querySelector<HTMLElement>('[data-slot=pedal-hud]')
    await waitFor(() => expect(hud()).toHaveAttribute('data-visible'))
    const line = hud()?.firstElementChild as HTMLElement
    await expect(line).toHaveTextContent('Key 4·Loop bars 5–8')
    await expect(line.offsetHeight).toBe(32)
    await expect(
      sameColour(getComputedStyle(line).backgroundColor, tokenColour('--raised', line)),
    ).toBe(true)
    await expect(
      insetRings(line).some((ring) => sameColour(ring.colour, tokenColour('--border', line))),
    ).toBe(true)
    await expect(getComputedStyle(hud() as HTMLElement).position).toBe('static')
    const notation = canvasElement.querySelector('[data-slot=notation]') as HTMLElement
    await expect(line.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      notation.getBoundingClientRect().top,
    )
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent(
      'Key 4 · Loop bars 5–8',
    )
    const first = hud()
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Again' }))
    await waitFor(() => expect(hud()).not.toBe(first))
    await expect(hud()).toHaveTextContent('Loop bars 5–8')
  },
}
export const PedalHudLineDark: Story = { ...PedalHudLine, globals: { appearance: 'dark' } }
export const PedalHudStage: Story = { render: () => <HudDemo />, globals: { appearance: 'stage' } }

/** The pedal's two meanings after a looped pass, as the HUD names them. */
export const PedalHudPedal: Story = {
  render: () => (
    <PedalHud
      message="Play"
      source="Right pedal"
      sequence={1}
      icon={<MetronomeIcon aria-hidden />}
    />
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-slot=pedal-hud]')).toHaveAttribute('data-visible'),
    )
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent('Right pedal · Play')
  },
}

export const Light: Story = { render: () => <Transport />, globals: { appearance: 'light' } }
export const Dark: Story = { render: () => <Transport />, globals: { appearance: 'dark' } }
export const Stage: Story = {
  render: () => <Transport />,
  globals: { appearance: 'stage', distance: 'stand' },
}
export const IncreasedContrast: Story = {
  render: () => <Transport />,
  globals: { contrast: 'more', appearance: 'light' },
}
export const Floor: Story = {
  render: () => <Transport />,
  globals: { distance: 'floor', appearance: 'dark' },
}
