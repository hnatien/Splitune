import { fileURLToPath } from 'node:url'
import { alphaTab } from '@coderline/alphatab-vite'
import { paraglideVitePlugin } from '@inlang/paraglide-js'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// What every consumer of app/ needs (the app, Storybook and Vitest): React, Tailwind with the
// Music Stand tokens, the `@/` alias and the compiled Paraglide messages. vite.config.ts adds
// TanStack Start, Nitro and the React Compiler for the app itself.
const paraglide = () =>
  paraglideVitePlugin({
    project: './project.inlang',
    outdir: './app/paraglide',
    // English only for now (10 §8): no URL or cookie locale detection.
    strategy: ['baseLocale'],
    emitTsDeclarations: true,
  })

export const alias = { '@': fileURLToPath(new URL('./app', import.meta.url)) }

// alphaTab's render worker (12 §3). Its fonts are not copied: Bravura is imported as an asset by
// @splitune/notation, and the SoundFont is unused (the synth is off in external-media mode).
const notation = () => alphaTab({ assetOutputDir: false, audioWorklets: false })

// After the plugins that must see JSX first (TanStack Router's code splitter).
export const sharedPlugins = () => [react(), tailwindcss(), paraglide(), notation()]

export default defineConfig({ plugins: sharedPlugins(), resolve: { alias } })
