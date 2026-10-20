// pnpm --filter @splitune/api openapi:check — generates the OpenAPI 3.1 document and validates it
// with @readme/openapi-parser (schema + spec rules). `--out <file>` also writes it.
import { writeFileSync } from 'node:fs'
import { validate } from '@readme/openapi-parser'
import { generateOpenApi } from '../src/openapi.ts'

const doc = await generateOpenApi()
const result = await validate(structuredClone(doc) as never)
if (!result.valid) for (const error of result.errors) console.error(`error: ${error.message}`)
for (const warning of result.warnings) console.error(`warning: ${warning.message}`)

const outIndex = process.argv.indexOf('--out')
const out = outIndex === -1 ? undefined : process.argv[outIndex + 1]
if (out) writeFileSync(out, `${JSON.stringify(doc, null, 2)}\n`)

const paths = Object.keys(doc.paths ?? {}).length
if (!result.valid) {
  console.error(`OpenAPI ${doc.openapi}: invalid (${paths} paths)`)
  process.exit(1)
}
console.log(`OpenAPI ${doc.openapi}: valid (${paths} paths)`)
