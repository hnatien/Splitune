import type { StorybookConfig } from '@storybook/react-vite'
import { DISPLAY_SCRIPT } from '../app/ui/display.ts'

// Storybook 10 workbench (docs/specs/28-ui-quality-and-design-review.md §2). The head gets
// the same inline display script and font preload as the app, so stories prove the real theming
// path, including no flash on load.
const config: StorybookConfig = {
  // The shared config (React, Tailwind, Paraglide, `@/`) without TanStack Start and Nitro.
  framework: {
    name: '@storybook/react-vite',
    options: { builder: { viteConfigPath: 'vite.base.ts' } },
  },
  stories: ['../app/**/*.stories.tsx'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-vitest'],
  staticDirs: ['../public'],
  core: { disableTelemetry: true },
  previewHead: (head) => `${head}
<script>${DISPLAY_SCRIPT}</script>
<link rel="preload" href="/fonts/InterVariable.woff2" as="font" type="font/woff2" crossorigin>`,
}

export default config
