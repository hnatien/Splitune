import { validate } from '@readme/openapi-parser'
import { describe, expect, it } from 'vitest'
import { generateOpenApi } from '../src/openapi.ts'
import { createTestApi } from './helpers.ts'

describe('OpenAPI document', () => {
  it('is a valid OpenAPI 3.1 document', async () => {
    const doc = await generateOpenApi('http://localhost:3000')
    const result = await validate(structuredClone(doc) as never)
    expect(result.valid ? [] : result.errors).toEqual([])
    expect(result.warnings).toEqual([])
    expect(doc.openapi).toMatch(/^3\.1\./)
  })

  it('documents every implemented route with the error envelope', async () => {
    const doc = (await generateOpenApi()) as unknown as {
      paths: Record<string, { get?: { responses: Record<string, unknown> } }>
    }
    expect(Object.keys(doc.paths).sort()).toEqual([
      '/v1/analyses',
      '/v1/analyses/{id}',
      '/v1/analyses/{id}/events',
      '/v1/analyses/{id}/rerun',
      '/v1/artefacts/{id}/corrections',
      '/v1/artefacts/{id}/url',
      '/v1/billing/checkout',
      '/v1/billing/mock/checkout',
      '/v1/billing/mock/portal',
      '/v1/billing/mock/session',
      '/v1/billing/plans',
      '/v1/billing/portal',
      '/v1/events',
      '/v1/examples',
      '/v1/examples/{id}/claim',
      '/v1/examples/{id}/url',
      '/v1/me',
      '/v1/practice/sync',
      '/v1/progress',
      '/v1/songs',
      '/v1/songs/import-url',
      '/v1/songs/{id}',
      '/v1/songs/{id}/loops',
      '/v1/songs/{id}/loops/{loop_id}',
      '/v1/songs/{id}/media',
      '/v1/system/stats',
      '/v1/system/worker-status',
      '/v1/uploads',
      '/v1/uploads/lookup',
      '/v1/uploads/{id}',
      '/v1/uploads/{id}/complete',
      '/v1/uploads/{id}/parts',
    ])
    const getSong = doc.paths['/v1/songs/{id}']?.get
    expect(JSON.stringify(getSong?.responses)).toContain('not_found')
  })

  it('is served at /v1/openapi.json', async () => {
    const api = createTestApi()
    try {
      const res = await api.app.request('/v1/openapi.json')
      expect(res.status).toBe(200)
      expect(((await res.json()) as { info: { title: string } }).info.title).toBe('Splitune API')
    } finally {
      await api.close()
    }
  })
})
