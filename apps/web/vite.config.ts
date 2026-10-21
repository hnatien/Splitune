import babel from '@rolldown/plugin-babel'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { reactCompilerPreset } from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig, loadEnv } from 'vite'
import { alias, sharedPlugins } from './vite.base.ts'

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
  return {
    server: { port: 3000, strictPort: true },
    resolve: { alias },
    plugins: [
      tanstackStart({ srcDirectory: 'app' }),
      // Railway's edge doesn't compress, so static assets ship pre-gzipped and pre-brotlied.
      nitro({ preset: 'node', compressPublicAssets: true }),
      ...sharedPlugins(),
      babel({ presets: [reactCompilerPreset()] }),
    ],
  }
})
