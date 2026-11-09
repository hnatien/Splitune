import type { Decorator, Preview } from '@storybook/react-vite'
import { cn } from '../app/lib/utils.ts'
import { applyDisplay } from '../app/ui/display.ts'
import { TooltipProvider } from '../app/ui/tooltip.tsx'
import '../app/styles.css'

// Toolbar globals set the same data-* attributes as the app (doc 26 §2, 28 §2), so every story is
// rendered through the real theming path. Density is per shell, so it goes on the story wrapper.
// "Side by side" renders the story twice, in Night Rehearsal and Daylight subtrees (subtree theming,
// 26 §2), with the page itself in Night. Pointer sets data-pointer, which the pointer-coarse and
// pointer-fine variants honour in place of the media query (the app never sets it).
// Screens render edge to edge like the app (their shells bring the gutters); components get a margin.
const SIDE_BY_SIDE = 'side-by-side'

const withDisplay: Decorator = (Story, context) => {
  const { appearance, contrast, density, distance, motion, readingFont, pointer } = context.globals
  const sideBySide = appearance === SIDE_BY_SIDE
  const root = document.documentElement
  // Applied during render, before paint, like the app's inline head script.
  applyDisplay(
    { appearance: sideBySide ? 'dark' : appearance, contrast, distance, motion, readingFont },
    root,
    (query) => window.matchMedia(query),
  )
  if (pointer === 'coarse' || pointer === 'fine') root.setAttribute('data-pointer', pointer)
  else root.removeAttribute('data-pointer')
  const frame = (theme?: 'dark' | 'light') => (
    <div
      key={theme ?? 'page'}
      data-appearance={theme}
      data-density={density}
      className={cn(
        'min-h-full bg-background text-foreground',
        !context.title.startsWith('Screens/') && 'p-6',
        sideBySide && 'min-w-0 flex-1',
      )}
    >
      <Story />
    </div>
  )
  return (
    <TooltipProvider>
      {sideBySide ? (
        <div className="flex min-h-full">
          {frame('dark')}
          {frame('light')}
        </div>
      ) : (
        frame()
      )}
    </TooltipProvider>
  )
}

const toolbar = (title: string, icon: string, items: { value: string; title: string }[]) => ({
  toolbar: { title, icon, items, dynamicTitle: true },
})

const preview: Preview = {
  decorators: [withDisplay],
  // Measure and screenshot with the real fonts, not the swap fallback.
  loaders: [
    async () => {
      await Promise.all([
        document.fonts.load('400 1em "Instrument Sans"'),
        document.fonts.load('600 1em "Instrument Sans"'),
        document.fonts.load('400 1em "JetBrains Mono"'),
        document.fonts.load('600 1em "JetBrains Mono"'),
        document.fonts.load('400 1em "Atkinson Hyperlegible Next"'),
      ])
      return {}
    },
  ],
  globalTypes: {
    appearance: toolbar('Appearance', 'mirror', [
      { value: 'dark', title: 'Night Rehearsal' },
      { value: 'light', title: 'Daylight' },
      { value: 'stage', title: 'Stage' },
      { value: SIDE_BY_SIDE, title: 'Side by side' },
    ]),
    contrast: toolbar('Contrast', 'contrast', [
      { value: 'normal', title: 'Normal contrast' },
      { value: 'more', title: 'Increased contrast' },
    ]),
    density: toolbar('Density', 'component', [
      { value: 'browse', title: 'Browse' },
      { value: 'practice', title: 'Practice' },
    ]),
    distance: toolbar('Distance', 'ruler', [
      { value: 'desk', title: 'Desk 0.5 m' },
      { value: 'stand', title: 'Music stand 0.75 m' },
      { value: 'floor', title: 'Floor 1.5 m' },
    ]),
    motion: toolbar('Motion', 'play', [
      { value: 'full', title: 'Full motion' },
      { value: 'reduce', title: 'Reduced motion' },
    ]),
    pointer: toolbar('Pointer', 'pointerhand', [
      { value: 'fine', title: 'Fine pointer' },
      { value: 'coarse', title: 'Coarse pointer' },
    ]),
    readingFont: toolbar('Reading font', 'paragraph', [
      { value: 'inter', title: 'Standard' },
      { value: 'hyperlegible', title: 'Hyperlegible' },
    ]),
  },
  initialGlobals: {
    appearance: 'dark',
    contrast: 'normal',
    density: 'browse',
    distance: 'desk',
    motion: 'full',
    pointer: 'fine',
    readingFont: 'inter',
  },
  parameters: {
    layout: 'fullscreen',
    a11y: {
      test: 'error',
      // 'body' so axe also checks portalled popups (dialogs, menus, tooltips). Base UI's
      // visually hidden focus guards get role="button" without a name in WebKit on purpose, so
      // VoiceOver's cursor can't leave an open popup (WCAG 4.1.2 false positive: they are
      // focus-redirect sentinels, not controls). Everything else is checked.
      context: { include: ['body'], exclude: ['[data-base-ui-focus-guard]'] },
    },
    controls: { expanded: true },
    options: {
      storySort: { order: ['Foundations', 'Base', 'Kit', 'Brand'] },
    },
  },
}

export default preview
