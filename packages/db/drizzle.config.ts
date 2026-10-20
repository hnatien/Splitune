import { defineConfig } from 'drizzle-kit'

try {
  process.loadEnvFile('../../.env')
} catch {
  // No .env file: rely on the environment (CI, Railway).
}

const { DATABASE_URL = '' } = process.env

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  dbCredentials: { url: DATABASE_URL },
  strict: true,
  verbose: true,
})
