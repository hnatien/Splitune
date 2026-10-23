import { describe, expect, it } from 'vitest'
import { createDb, KEEPALIVE_IDLE_MS } from '../src/index.ts'

const URL = 'postgres://u:p@127.0.0.1:1/none'

describe('createDb', () => {
  it('turns TCP keepalive on for the workers, probing after 30 s idle', async () => {
    const db = createDb({ url: URL, keepAlive: true })
    expect(db.$client.options).toMatchObject({
      keepAlive: true,
      keepAliveInitialDelayMillis: KEEPALIVE_IDLE_MS,
    })
    expect(KEEPALIVE_IDLE_MS).toBe(30_000)
    await db.$client.end()
  })

  it('leaves it off by default, so an idle app sends nothing and Railway can sleep it', async () => {
    const db = createDb({ url: URL })
    expect(db.$client.options.keepAlive).toBeUndefined()
    await db.$client.end()
  })
})
