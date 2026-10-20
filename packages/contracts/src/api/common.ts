import { z } from 'zod'

export const IdInput = z.object({ id: z.uuid() })

export const PageInput = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
})

export function page<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item), next_cursor: z.string().nullable() })
}

// Same-origin path in personal mode (e.g. "/billing/mock-checkout?session=…"), absolute URL otherwise.
export const RedirectOutput = z.object({ url: z.string().min(1) })
