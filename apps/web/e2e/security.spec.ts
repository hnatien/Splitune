import { expect, test } from '@playwright/test'

// Step 16's security pass (17 §5, §9) against the built server: the document's headers and CSP
// nonce, the headers on static files (served by Nitro before app/server.ts) and on the API, and a
// violation that is blocked and reported to /internal/csp-report.

test.beforeEach(({ isMobile }) => {
  test.skip(isMobile, 'headers and CSP are the same for every device')
})

const header = (headers: Record<string, string>, name: string) => headers[name] ?? ''

test('the document is served with a nonce CSP, reporting and the security headers', async ({
  request,
}) => {
  const response = await request.get('/')
  const headers = response.headers()
  const csp = header(headers, 'content-security-policy')
  const nonce = csp.match(/'nonce-([^']+)'/)?.[1]
  expect(nonce).toBeTruthy()
  expect(csp).toContain("default-src 'self'")
  expect(csp).toContain("object-src 'none'")
  expect(csp).toContain("frame-ancestors 'none'")
  expect(csp).toContain('report-uri /internal/csp-report')
  expect(csp).not.toMatch(/script-src[^;]*'unsafe-(inline|eval)'/)
  expect(headers).not.toHaveProperty('content-security-policy-report-only')
  expect(header(headers, 'x-content-type-options')).toBe('nosniff')
  expect(header(headers, 'referrer-policy')).toBe('strict-origin-when-cross-origin')
  expect(header(headers, 'permissions-policy')).toContain('camera=()')
  // No cross-origin isolation: it would break the YouTube embed in Safari and Firefox (24 §5).
  expect(headers).not.toHaveProperty('cross-origin-opener-policy')
  expect(headers).not.toHaveProperty('cross-origin-embedder-policy')
  // Every inline script carries this response's nonce.
  const html = await response.text()
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/g)].map((m) => m[1] ?? '')
  expect(inline.length).toBeGreaterThan(0)
  for (const attributes of inline) expect(attributes).toContain(`nonce="${nonce}"`)
  test.info().annotations.push({ type: 'csp', description: csp })
})

test('static files and the API carry nosniff and a referrer policy', async ({ request }) => {
  const html = await (await request.get('/')).text()
  const script = html.match(/src="(\/assets\/[^"]+\.js)"/)?.[1]
  expect(script).toBeTruthy()
  for (const path of [script ?? '', '/sw.js', '/manifest.webmanifest']) {
    const headers = (await request.get(path)).headers()
    expect(header(headers, 'x-content-type-options'), path).toBe('nosniff')
    expect(header(headers, 'referrer-policy'), path).toBe('strict-origin-when-cross-origin')
  }
  const api = await request.get('/v1/me')
  expect(api.status()).toBe(401)
  expect(header(api.headers(), 'x-content-type-options')).toBe('nosniff')
  expect(header(api.headers(), 'cache-control')).toBe('no-store')
})

test('a resource the policy forbids is blocked and reported', async ({ page, browserName }) => {
  const reported = page.waitForRequest(
    (request) => request.url().endsWith('/internal/csp-report') && request.method() === 'POST',
  )
  await page.goto('/')
  const violation = await page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        document.addEventListener('securitypolicyviolation', (event) =>
          resolve(event.effectiveDirective),
        )
        const image = document.createElement('img')
        image.src = 'https://csp-check.invalid/pixel.png'
        document.body.append(image)
      }),
  )
  expect(violation).toMatch(/^img-src/)
  const request = await reported
  expect(request.postData() ?? '').toContain('csp-check.invalid')
  test.info().annotations.push({
    type: `csp report (${browserName})`,
    description: request.headers()['content-type'] ?? '',
  })
})
