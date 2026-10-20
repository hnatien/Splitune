// pnpm db:migrate — applies packages/db/migrations to DATABASE_URL (Railway: pre-deploy command).
import { runMigrations } from '../src/migrate.ts'
import { requireEnv } from './env.ts'

await runMigrations(requireEnv('DATABASE_URL'))
console.log('Migrations applied.')
