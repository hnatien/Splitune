// Web security headers (17-security.md §5). No COOP/COEP: cross-origin isolation would break the
// YouTube embed fallback in Safari and Firefox (24-browser-compatibility.md §5).

// The request header app/server.ts sets with each document's CSP nonce; the router reads it so
// TanStack Start's inline hydration scripts and the display script carry the nonce.
export const NONCE_HEADER = 'x-splitune-csp-nonce'

const YOUTUBE_FRAMES = ['https://www.youtube-nocookie.com', 'https://www.youtube.com']

// Where browsers post violations (the API's /internal/csp-report, logged as "csp violation").
// report-uri only: Chromium ignores it next to report-to, and its Reporting API uploads were never
// delivered in testing; every Tier 1 browser honours report-uri.
const CSP_REPORT_PATH = '/internal/csp-report'

/**
 * Where the browser talks to object storage (presigned part PUTs, stem and video GETs): the
 * S3 endpoint's origin, widened to its subdomains when the bucket is addressed virtual-host style
 * (Cloudflare R2: https://<bucket>.<account>.r2.cloudflarestorage.com).
 */
export function storageSources(env: NodeJS.ProcessEnv): string[] {
  const { S3_ENDPOINT: endpoint, S3_FORCE_PATH_STYLE: pathStyle } = env
  if (!endpoint) return []
  const url = new URL(endpoint)
  if (url.hostname.endsWith('.r2.cloudflarestorage.com')) {
    return ['https://*.r2.cloudflarestorage.com']
  }
  if (pathStyle === 'false') return [`${url.protocol}//*.${url.host}`]
  return [url.origin]
}

export interface CspOptions {
  nonce: string
  storage: string[]
  /** Vite's dev server injects inline module scripts and talks to its HMR socket. */
  dev: boolean
}

export function contentSecurityPolicy({ nonce, storage, dev }: CspOptions): string {
  const scripts = dev
    ? ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'"]
    : ["'self'", `'nonce-${nonce}'`, "'wasm-unsafe-eval'"]
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': scripts,
    'worker-src': ["'self'", 'blob:'],
    'connect-src': ["'self'", ...storage, ...(dev ? ['ws:'] : [])],
    'frame-src': YOUTUBE_FRAMES,
    'img-src': ["'self'", 'data:', 'blob:', 'https://i.ytimg.com'],
    'media-src': ["'self'", 'blob:', ...storage],
    'style-src': ["'self'", "'unsafe-inline'"],
    'font-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'report-uri': [CSP_REPORT_PATH],
  }
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ')
}

/**
 * Headers on every response, static files included: Nitro serves .output/public before the server
 * entry runs (vite.config.ts route rules), so those never get securityHeaders().
 */
export const BASE_HEADERS = {
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-content-type-options': 'nosniff',
} as const

export function securityHeaders(
  options: CspOptions & {
    production: boolean
    /**
     * CSP_REPORT_ONLY: send the policy as Content-Security-Policy-Report-Only, so a changed policy
     * can be watched in the logs before it's enforced (17 §9).
     */
    reportOnly?: boolean
  },
): Record<string, string> {
  return {
    ...BASE_HEADERS,
    [options.reportOnly ? 'content-security-policy-report-only' : 'content-security-policy']:
      contentSecurityPolicy(options),
    // Microphone for "Record yourself" and (v1) mic scoring; the page is one document across
    // client-side navigation, so the grant can't be limited to /import.
    'permissions-policy': 'microphone=(self), camera=(), geolocation=(), midi=(self)',
    ...(options.production
      ? { 'strict-transport-security': 'max-age=63072000; includeSubDomains; preload' }
      : {}),
  }
}
