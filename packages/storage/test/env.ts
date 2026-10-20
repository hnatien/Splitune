for (const file of ['../../../.env', '../../../.env.example']) {
  try {
    process.loadEnvFile(new URL(file, import.meta.url))
  } catch {
    // Missing file: fall through to the next one.
  }
}
