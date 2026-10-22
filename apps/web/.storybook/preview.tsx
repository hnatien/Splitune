import type { Decorator, Preview } from '@storybook/react-vite'
import { applyDisplay } from '../app/ui/display.ts'
import { TooltipProvider } from '../app/ui/tooltip.tsx'
import '../app/styles.css'

// Toolbar globals set the same data-* attributes as the app (doc 26 §2, 28 §2), so every story is
// rendered through the real theming path. Density is per shell, so it goes on the story wrapper.
const withDisplay: Decorator = (Story, context) => {
  const { appearance, contrast, density, distance, motion, readingFont, score } = context.globals
  // Applied during render, before paint, like the app's inline head script.
  applyDisplay(
    { appearance, contrast, distance, motion, readingFont, score },
    document.documentElement,
    (query) => window.matchMedia(query),
  )
  return (
    <TooltipProvider>
      <div data-density={density} className="min-h-full bg-background p-6 text-foreground">
        <Story />
      </div>
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
        document.fonts.load('400 1em Inter'),
        document.fonts.load('600 1em Inter'),
        document.fonts.load('400 1em "Atkinson Hyperlegible Next"'),
      ])
      return {}
    },
  ],
  globalTypes: {
    appearance: toolbar('Appearance', 'mirror', [
      { value: 'light', title: 'Light' },
      { value: 'dark', title: 'Dark' },
      { value: 'stage', title: 'Stage' },
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
      { value: 'stand', title: 'Stand 0.75 m' },
      { value: 'floor', title: 'Floor 1.5 m' },
    ]),
    motion: toolbar('Motion', 'play', [
      { value: 'full', title: 'Full motion' },
      { value: 'reduce', title: 'Reduced motion' },
    ]),
    readingFont: toolbar('Reading font', 'paragraph', [
      { value: 'inter', title: 'Inter' },
      { value: 'hyperlegible', title: 'Hyperlegible' },
    ]),
    score: toolbar('Score', 'document', [
      { value: 'paper', title: 'Score on paper' },
      { value: 'match', title: 'Score matches appearance' },
    ]),
  },
  initialGlobals: {
    appearance: 'light',
    contrast: 'normal',
    density: 'browse',
    distance: 'desk',
    motion: 'full',
    readingFont: 'inter',
    score: 'paper',
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
