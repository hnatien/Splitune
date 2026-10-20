import { createHmac } from 'node:crypto'
import { type Logger, pino } from 'pino'

export type { Logger }

// Structured JSON logs on stdout (Railway logs; 16-observability-analytics-experiments.md). Request
// logs carry the path without its query string: magic-link tokens and presigned signatures live in
// query strings and must never reach a log. Headers and bodies are never logged.
export function createLogger(level: string): Logger {
  return pino({
    level,
    base: { service: 'api' },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: { level: (label) => ({ level: label }) },
    redact: {
      paths: ['cookie', 'authorization', '*.cookie', '*.authorization', 'url', '*.url'],
      censor: '[redacted]',
    },
  })
}

// Salted, truncated user id for logs (16 "Logs": user_hash), so log lines can be correlated per
// user without storing the id itself.
export function userHasher(secret: string): (userId: string) => string {
  const key = createHmac('sha256', secret).update('splitune.log.user_hash').digest()
  return (userId) => createHmac('sha256', key).update(userId).digest('hex').slice(0, 16)
}
