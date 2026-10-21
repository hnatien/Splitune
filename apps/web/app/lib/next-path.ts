// Where to return after sign-in: a same-origin path only, never another site (open redirect).
export function safeNext(value: unknown, fallback = '/library'): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return fallback
  if (value.startsWith('/auth/') || value.includes('\\')) return fallback
  return value
}
