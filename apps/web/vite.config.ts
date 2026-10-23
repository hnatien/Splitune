import { fileURLToPath } from 'node:url'
import babel from '@rolldown/plugin-babel'
import { serwist } from '@serwist/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { reactCompilerPreset } from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig, loadEnv } from 'vite'
import { BASE_HEADERS } from './app/server/headers.ts'
import { alias, sharedPlugins } from './vite.base.ts'

// Nitro serves .output/public as the site root.
const PUBLIC_DIR = fileURLToPath(new URL('./.output/public', import.meta.url))
const PUBLIC_SW = fileURLToPath(new URL('./.output/public/sw.js', import.meta.url))

// The app (10-web-app-architecture.md): TanStack Start with the routes in app/routes, the Hono API
// mounted under /v1 by app/server.ts, built by Nitro's node preset into one server that Railway
// starts on PORT (25-personal-mode.md §1). The React Compiler memoises components.
export default defineConfig(({ command, mode }) => {
  // `vite dev` serves the app with the server reading process.env, as in production; locally that
  // is the repository's .env (copied from .env.example by `pnpm run setup`). Builds read nothing
  // from it, and NODE_ENV stays Vite's own (a "development" there would build dev JSX).
  if (command === 'serve') {
    const { NODE_ENV: _mode, ...env } = loadEnv(mode, '../..', '')
    Object.assign(process.env, { ...env, ...process.env })
  }
  // Self-hosted fonts and icons keep fixed names (fonts.css, the preload, the manifest), so a
  // changed file needs a new name: browsers keep these for a year without revalidating.
  const immutable = { headers: { 'cache-control': 'public, max-age=31536000, immutable' } }
  return {
    server: { port: 3000, strictPort: true },
    resolve: { alias },
    plugins: [
      tanstackStart({ srcDirectory: 'app' }),
      // Railway's edge doesn't compress, so static assets ship pre-gzipped and pre-brotlied.
      // Static files skip app/server.ts: they get the base security headers here (17 §5).
      nitro({
        preset: 'node',
        compressPublicAssets: true,
        routeRules: {
          '/**': { headers: BASE_HEADERS },
          '/fonts/**': immutable,
          '/icons/**': immutable,
        },
      }),
      ...sharedPlugins(),
      babel({ presets: [reactCompilerPreset()] }),
      // The service worker (10 §6): app/sw.ts bundled into Nitro's public folder as /sw.js with
      // the app shell's precache list. Fonts, WASM and alphaTab (its render chunk is the one file
      // over the size cap) are cached on first use instead (runtime caching in sw.ts).
      serwist({
        swSrc: 'app/sw.ts',
        swDest: PUBLIC_SW,
        globDirectory: PUBLIC_DIR,
        globPatterns: ['**/*.{js,css,svg,png,webmanifest}'],
        globIgnores: ['sw.js', '**/*.worker-*.js', '**/alphaTab*'],
        maximumFileSizeToCacheInBytes: 600 * 1024,
        injectionPoint: 'self.__SW_MANIFEST',
        rollupFormat: 'iife',
      }),
    ],
  }
})
