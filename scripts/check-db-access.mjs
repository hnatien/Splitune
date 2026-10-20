// Part of `pnpm lint`: raw Drizzle queries are only allowed in packages/db's repositories and job
// queue (17-security.md §2: every user-scoped query goes through a helper that requires userId).
// Flags select/insert/update/delete/execute/$count calls and the relational `query` API on any
// identifier ending in db/Db/DB/tx/Tx (also across line breaks), in tracked and new files.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const ALLOWED = [
  'packages/db/src/repo/',
  'packages/db/src/jobs/',
  'packages/db/src/client.ts', // withUser() itself
  'packages/db/src/rate-limit.ts', // request counters, not user data
  'packages/db/scripts/', // migrate, roles, seed
  'packages/db/test/',
  'apps/api/test/rls.test.ts', // bypasses the repositories on purpose to prove RLS holds
]
const SOURCE = /\.(ts|tsx|mts|cts|js|mjs|cjs)$/
const RAW_QUERY =
  /\b\w*(?:db|Db|DB|tx|Tx)\s*\.\s*(?:(?:select|selectDistinct|selectDistinctOn|insert|update|delete|execute|\$count)\s*\(|query\s*\.)/g

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
  cwd: root,
  encoding: 'utf8',
})
  .split('\n')
  .filter((file) => SOURCE.test(file) && !ALLOWED.some((prefix) => file.startsWith(prefix)))

const violations = []
for (const file of files) {
  let text
  try {
    text = readFileSync(join(root, file), 'utf8')
  } catch {
    continue // listed by git but deleted in the working tree
  }
  for (const match of text.matchAll(RAW_QUERY)) {
    const line = text.slice(0, match.index).split('\n').length
    violations.push(`${file}:${line}: ${match[0].replace(/\s+/g, '')}`)
  }
}

if (violations.length > 0) {
  console.error('Raw database queries outside packages/db/src/{repo,jobs}/:')
  for (const violation of violations) console.error(`  ${violation}`)
  console.error('Use a repository function from @splitune/db (they take userId first).')
  process.exit(1)
}
console.log(`check-db-access: ${files.length} files, no raw queries outside repo/ and jobs/.`)
