import { type SQL, sql } from 'drizzle-orm'
import { type AnyPgColumn, customType, timestamp } from 'drizzle-orm/pg-core'

// Case-insensitive text (extension created by the first migration).
export const citext = customType<{ data: string }>({
  dataType: () => 'citext',
})

export const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' })

// `column in ('a', 'b')` for check constraints. Values come from the Zod enums in
// @splitune/contracts, so the database and the wire format accept the same set.
export function oneOf(column: AnyPgColumn, values: readonly string[]): SQL {
  const list = values.map((value) => `'${value.replaceAll("'", "''")}'`).join(', ')
  return sql`${column} in (${sql.raw(list)})`
}

// Zod 4 exposes enum options as an array; Drizzle's `enum` option wants a non-empty tuple.
export const values = <T extends string>(zodEnum: { options: readonly T[] }) =>
  zodEnum.options as unknown as [T, ...T[]]
