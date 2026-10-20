// Emits JSON Schema for every registered contract (run with `pnpm --filter contracts build`):
// - schema/contracts.json: all named types under $defs; services/ml generates Pydantic models from it
// - schema/<Type>.json: one self-contained schema per top-level document
// Pass `--out <dir>` to write somewhere else (used by `pnpm contracts:check`).
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { z } from 'zod'
import {
  Beats,
  CalibrationTable,
  Chords,
  CorrectionOp,
  contracts,
  DrumNotes,
  ErrorEnvelope,
  JobEvent,
  Manifest,
  Notes,
  Presence,
  SCHEMA_VERSION,
  Sections,
  StageRequest,
  StageResult,
  Stems,
  Summary,
  Tab,
} from '../src/index.ts'

const DOCUMENTS = {
  Manifest,
  Beats,
  Presence,
  Stems,
  Sections,
  Chords,
  Notes,
  DrumNotes,
  Tab,
  Summary,
  CorrectionOp,
  CalibrationTable,
  StageRequest,
  StageResult,
  JobEvent,
  ErrorEnvelope,
}

const JSON_SCHEMA_DIALECT = 'https://json-schema.org/draft/2020-12/schema'

// `io: 'input'` leaves out `additionalProperties: false`: readers ignore unknown fields (S8).
// Discriminated unions get the OpenAPI `discriminator` annotation so Pydantic picks the variant
// by its tag instead of trying each one.
const options = {
  target: 'draft-2020-12',
  io: 'input',
  unrepresentable: 'throw',
  override: ({ zodSchema, jsonSchema }) => {
    const { def } = zodSchema._zod
    if (def.type === 'union' && 'discriminator' in def && typeof def.discriminator === 'string') {
      Object.assign(jsonSchema, { discriminator: { propertyName: def.discriminator } })
    }
  },
} as const satisfies z.core.ToJSONSchemaParams

function write(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

const { values } = parseArgs({ options: { out: { type: 'string' } } })
const outDir = values.out ?? join(import.meta.dirname, '..', 'schema')
rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

const bundled = z.toJSONSchema(contracts, { ...options, uri: (id) => `#/$defs/${id}` })
const defs: Record<string, unknown> = {}
for (const id of Object.keys(bundled.schemas).sort()) {
  const { $schema: _dialect, $id: _id, ...definition } = bundled.schemas[id] ?? {}
  defs[id] = definition
}
write(join(outDir, 'contracts.json'), {
  $schema: JSON_SCHEMA_DIALECT,
  title: 'Splitune contracts',
  'x-schema-version': SCHEMA_VERSION,
  $defs: defs,
})

for (const [id, schema] of Object.entries(DOCUMENTS)) {
  const { $id: _id, ...document } = z.toJSONSchema(schema, { ...options, metadata: contracts })
  write(join(outDir, `${id}.json`), { ...document, title: id })
}
