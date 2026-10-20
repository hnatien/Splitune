import { z } from 'zod'

// Every schema registered here becomes a named definition in `schema/contracts.json`, which is
// what the Pydantic models in services/ml are generated from. Register nested objects too, so
// the generated Python classes get stable names instead of ones derived from field names.
export const contracts = z.registry<{ id: string }>()
