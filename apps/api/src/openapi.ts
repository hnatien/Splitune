import { OpenAPIGenerator } from '@orpc/openapi'
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4'
import { ErrorEnvelope } from '@splitune/contracts'
import { z } from 'zod'
import { router } from './router.ts'

// OpenAPI 3.1 document of the implemented v1 procedures (served at /v1/openapi.json, consumed by
// native clients and docs). Error responses use the shared ErrorEnvelope.
export async function generateOpenApi(serverUrl?: string) {
  const generator = new OpenAPIGenerator({ schemaConverters: [new ZodToJsonSchemaConverter()] })
  const doc = await generator.generate(router, {
    info: {
      title: 'Splitune API',
      version: '1.0.0',
      description:
        'Signed-in requests use the Better Auth session cookie (`splitune.session_token`, sign-in under /v1/auth). Cookie-authenticated mutations must send `X-Splitune-CSRF: 1`.',
    },
    ...(serverUrl ? { servers: [{ url: serverUrl }] } : {}),
    customErrorResponseBodySchema: () =>
      z.toJSONSchema(ErrorEnvelope, { target: 'draft-2020-12', io: 'output' }) as never,
  })
  // The generator leaves `undefined`-valued keys (e.g. allowEmptyValue on path parameters) that
  // JSON drops; normalise so the object we validate is exactly the document we serve.
  return JSON.parse(JSON.stringify(doc)) as typeof doc
}
