// JSON lines on stdout, like the Python worker: ids, stages, timings and error codes only — never
// object keys, URLs or user content.
export interface Logger {
  info(msg: string, fields?: Record<string, unknown>): void
  warn(msg: string, fields?: Record<string, unknown>): void
  error(msg: string, fields?: Record<string, unknown>): void
}

export function createLogger(
  write: (line: string) => void = (l) => process.stdout.write(l),
): Logger {
  const emit =
    (level: string) =>
    (msg: string, fields: Record<string, unknown> = {}) =>
      write(
        `${JSON.stringify({ level, service: 'node-worker', msg, ...fields, at: new Date().toISOString() })}\n`,
      )
  return { info: emit('info'), warn: emit('warn'), error: emit('error') }
}
