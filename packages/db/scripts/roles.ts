// pnpm db:roles — lets the restricted roles log in, with passwords from the environment. Run it as
// the database owner after `pnpm db:migrate`; roles without a password variable stay NOLOGIN.
// Workers then connect as e.g. postgres://ml_worker:<password>@host/db (DATABASE_PUBLIC_URL).
import pg from 'pg'
import { requireEnv } from './env.ts'

const ROLE_PASSWORD_VARS = {
  app: 'DB_APP_PASSWORD',
  ml_worker: 'DB_ML_WORKER_PASSWORD',
  node_worker: 'DB_NODE_WORKER_PASSWORD',
  maintenance: 'DB_MAINTENANCE_PASSWORD',
} as const

const client = new pg.Client({ connectionString: requireEnv('DATABASE_URL') })
await client.connect()
try {
  for (const [role, variable] of Object.entries(ROLE_PASSWORD_VARS)) {
    const password = process.env[variable]
    if (!password) {
      console.log(`${role}: ${variable} not set, left unchanged`)
      continue
    }
    // ALTER ROLE takes no bind parameters; the role is a constant and the password is escaped.
    await client.query(
      `alter role ${client.escapeIdentifier(role)} with login password ${client.escapeLiteral(password)}`,
    )
    console.log(`${role}: login enabled`)
  }
} finally {
  await client.end()
}
