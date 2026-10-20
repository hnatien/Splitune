// pnpm db:check — fails if the Drizzle schema has changes that no migration in migrations/ covers
// (02-repo-tooling-and-ci.md, `migrations` job). Generates into a temp copy, so the working tree is
// never touched, and needs no database.
import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'

const out = mkdtempSync(join(tmpdir(), 'splitune-migrations-'))
try {
  cpSync('migrations', out, { recursive: true })
  const before = new Set(readdirSync(out))
  execFileSync(
    'pnpm',
    [
      'exec',
      'drizzle-kit',
      'generate',
      '--dialect=postgresql',
      '--schema=./src/schema/index.ts',
      // drizzle-kit prefixes './' to --out, so it must be relative.
      `--out=${relative(process.cwd(), out)}`,
      '--name=drift',
    ],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  )
  const added = readdirSync(out).filter((file) => !before.has(file))
  if (added.length > 0) {
    console.error(`Schema changes without a migration (would generate ${added.join(', ')}).`)
    console.error('Run `pnpm --filter @splitune/db generate`, review the SQL and commit it.')
    process.exit(1)
  }
  console.log('Migrations match the schema.')
} finally {
  rmSync(out, { recursive: true, force: true })
}
