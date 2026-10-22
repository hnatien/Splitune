import { FLAG_KEYS, FLAGS, type FlagKey } from '@splitune/contracts'

// Typed feature flags (16 §5), evaluated on the server: a feature_flags row decides; without one
// the flag's declared default applies. The rows are cached briefly, so a flag flipped in the
// database takes effect within FLAG_TTL_MS without a deploy.

export const FLAG_TTL_MS = 30_000

export interface FlagRow {
  key: string
  enabled: boolean
}

export function evaluateFlags(rows: readonly FlagRow[]): Record<FlagKey, boolean> {
  const stored = new Map(rows.map((row) => [row.key, row.enabled]))
  return Object.fromEntries(
    FLAG_KEYS.map((key) => [key, stored.get(key) ?? FLAGS[key].default]),
  ) as Record<FlagKey, boolean>
}

export interface Flags {
  flag(key: FlagKey): Promise<boolean>
  all(): Promise<Record<FlagKey, boolean>>
}

export function createFlags(
  load: () => Promise<FlagRow[]>,
  { ttlMs = FLAG_TTL_MS, now = Date.now }: { ttlMs?: number; now?: () => number } = {},
): Flags {
  let cached: { at: number; values: Promise<Record<FlagKey, boolean>> } | undefined
  const all = () => {
    if (!cached || now() - cached.at >= ttlMs) {
      const values = load().then(evaluateFlags)
      // A failed load is not cached: the next call tries again.
      values.catch(() => {
        if (cached?.values === values) cached = undefined
      })
      cached = { at: now(), values }
    }
    return cached.values
  }
  return { all, flag: async (key) => (await all())[key] }
}
