export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    console.error(`${name} is not set (see .env.example).`)
    process.exit(1)
  }
  return value
}
