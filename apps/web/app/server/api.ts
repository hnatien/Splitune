import { type Api, configFromEnv, createApi } from '@splitune/api'
import { createDb } from '@splitune/db'
import { createStorage, storageConfigFromEnv } from '@splitune/storage'

// The API (apps/api) lives in the web server's process (25-personal-mode.md §1): app/server.ts
// routes /v1/* and /internal/* to it, and server-side loaders call it without a network hop.
let api: Api | undefined

export function getApi(): Api {
  if (!api) {
    const { DATABASE_URL: url } = process.env
    if (!url) throw new Error('DATABASE_URL is not set')
    api = createApi({
      db: createDb({ url, applicationName: 'splitune-app' }),
      storage: createStorage(storageConfigFromEnv()),
      config: configFromEnv(),
    })
  }
  return api
}
