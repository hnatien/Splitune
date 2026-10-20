import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { contract } from './api/router.ts'
import { SCHEMA_VERSION } from './index.ts'

interface JsonSchema {
  type?: string | string[]
  properties?: Record<string, JsonSchema>
  required?: string[]
  anyOf?: JsonSchema[]
  oneOf?: JsonSchema[]
  items?: JsonSchema
  additionalProperties?: boolean | JsonSchema
  $ref?: string
}

const bundle = JSON.parse(
  readFileSync(new URL('../schema/contracts.json', import.meta.url), 'utf8'),
) as { 'x-schema-version': string; $defs: Record<string, JsonSchema> }

function allowsNull(schema: JsonSchema): boolean {
  const types = Array.isArray(schema.type) ? schema.type : [schema.type]
  return types.includes('null') || (schema.anyOf ?? []).some(allowsNull)
}

function* objects(schema: JsonSchema): Generator<JsonSchema> {
  if (schema.properties !== undefined) yield schema
  for (const child of [
    ...Object.values(schema.properties ?? {}),
    ...(schema.anyOf ?? []),
    ...(schema.oneOf ?? []),
    ...(schema.items === undefined ? [] : [schema.items]),
  ]) {
    yield* objects(child)
  }
}

describe('JSON Schema bundle', () => {
  it('carries the schema version', () => {
    expect(bundle['x-schema-version']).toBe(SCHEMA_VERSION)
  })

  it('never forbids unknown fields (S8)', () => {
    for (const definition of Object.values(bundle.$defs)) {
      for (const object of objects(definition)) {
        expect(object.additionalProperties).not.toBe(false)
      }
    }
  })

  // Python writers drop None values (`dump_json`), which is only lossless while no required
  // field is nullable.
  it('has no required nullable fields', () => {
    for (const [id, definition] of Object.entries(bundle.$defs)) {
      for (const object of objects(definition)) {
        for (const name of object.required ?? []) {
          const property = object.properties?.[name]
          expect(property && allowsNull(property), `${id}.${name}`).toBeFalsy()
        }
      }
    }
  })
})

describe('oRPC contract', () => {
  const procedures = Object.entries(contract).flatMap(([group, routes]) =>
    Object.entries(routes).map(([name, procedure]) => [`${group}.${name}`, procedure] as const),
  )

  it('gives every procedure a unique /v1 route', () => {
    const routes = procedures.map(([, procedure]) => {
      const { method, path } = procedure['~orpc'].route
      expect(path).toMatch(/^\/v1\//)
      return `${method} ${path}`
    })
    expect(new Set(routes).size).toBe(routes.length)
  })

  it('declares every path parameter in the input schema', () => {
    for (const [name, procedure] of procedures) {
      const { path } = procedure['~orpc'].route
      const params = [...(path ?? '').matchAll(/\{(\w+)\}/g)].map((match) => match[1])
      if (params.length === 0) continue
      const input = procedure['~orpc'].inputSchema as { shape?: Record<string, unknown> }
      for (const param of params) {
        expect(input.shape, name).toHaveProperty(param as string)
      }
    }
  })
})
