// Content Security Policy violation reports (17-security.md §5, §9). The web app's policy names
// `report-uri`, which posts { "csp-report": {…} } (application/csp-report); the Reporting API's
// array of { type: "csp-violation", body: {…} } is read too, should a policy use `report-to`. The body is untrusted
// input: only the directive, the blocked resource (origin and path, or a keyword such as
// "inline") and the page's path are kept, each capped in length; query strings never reach logs.

export interface CspViolation {
  directive: string
  blocked: string
  page: string
}

const MAX_REPORTS = 10
const MAX_FIELD = 200

// The fields read from either format; everything else in a report is ignored.
type ReportFields = {
  'effective-directive'?: unknown
  'violated-directive'?: unknown
  'blocked-uri'?: unknown
  'document-uri'?: unknown
  'csp-report'?: unknown
  effectiveDirective?: unknown
  violatedDirective?: unknown
  blockedURL?: unknown
  documentURL?: unknown
  type?: unknown
  body?: unknown
}

const isObject = (value: unknown): value is ReportFields =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const text = (value: unknown): string =>
  typeof value === 'string' ? value.slice(0, MAX_FIELD) : ''

function withoutQuery(value: string): string {
  try {
    const url = new URL(value)
    return `${url.origin}${url.pathname}`.slice(0, MAX_FIELD)
  } catch {
    // A keyword ("inline", "eval", "data", "blob") or empty.
    return value.split(/[?#]/)[0] ?? ''
  }
}

function pagePath(value: string): string {
  try {
    return new URL(value).pathname.slice(0, MAX_FIELD)
  } catch {
    return ''
  }
}

function violation(body: ReportFields): CspViolation | undefined {
  const directive = text(
    body['effective-directive'] ??
      body.effectiveDirective ??
      body['violated-directive'] ??
      body.violatedDirective,
  )
  if (!directive) return undefined
  return {
    directive,
    blocked: withoutQuery(text(body['blocked-uri'] ?? body.blockedURL)),
    page: pagePath(text(body['document-uri'] ?? body.documentURL)),
  }
}

/** The violations in a report request, in either format; anything else yields none. */
export function parseCspReports(payload: unknown): CspViolation[] {
  const bodies: unknown[] = Array.isArray(payload)
    ? payload
        .filter((report) => isObject(report) && report.type === 'csp-violation')
        .map((report) => (report as ReportFields).body)
    : isObject(payload)
      ? [payload['csp-report']]
      : []
  return bodies
    .filter(isObject)
    .slice(0, MAX_REPORTS)
    .map(violation)
    .filter((v): v is CspViolation => v !== undefined)
}
