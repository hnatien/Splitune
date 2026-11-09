import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
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

// Settings → About (27 §3.9): the build's commit and date, and the models the pipeline runs, read
// from the provenance register at build time (`compliance/register/models`; eval-only candidates
// left out). Only the About chunk references it.
const REGISTER = fileURLToPath(new URL('../../compliance/register/models/', import.meta.url))

function commit(): string | null {
  const railway = process.env['RAILWAY_GIT_COMMIT_SHA']
  if (railway) return railway.slice(0, 7)
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

function models(): { name: string; version: string }[] {
  const field = (text: string, key: string) =>
    new RegExp(`^${key}: "?(.*?)"?$`, 'm').exec(text)?.[1] ?? ''
  return readdirSync(REGISTER)
    .filter((file) => file.endsWith('.yaml'))
    .map((file) => readFileSync(REGISTER + file, 'utf8'))
    .filter((text) =>
      field(text, 'used_in')
        .replace(/[[\]\s]/g, '')
        .split(',')
        .some((s) => s && s !== 'eval'),
    )
    .map((text) => ({ name: field(text, 'name'), version: field(text, 'version') }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

// A dev server dates itself by its commit: Vite hashes `define` into the dependency optimizer's
// cache key, so a start time would re-bundle every dependency on each `vite dev`.
function commitDate(): string {
  try {
    return execFileSync('git', ['log', '-1', '--format=%cI'], { encoding: 'utf8' }).trim()
  } catch {
    return new Date(0).toISOString()
  }
}

export const buildDefines = ({ build = false } = {}) => ({
  __SPLITUNE_BUILD__: JSON.stringify({
    commit: commit(),
    builtAt: build ? new Date().toISOString() : commitDate(),
    models: models(),
  }),
})

export default defineConfig({
  plugins: sharedPlugins(),
  resolve: { alias },
  define: buildDefines(),
})
