import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

// `/import` became Add song, a dialog over the library (27 §1 route map): `/import` and
// `/import?tab=record` (onboarding's "Record yourself") open it on that tab.
export const Route = createFileRoute('/_app/import')({
  validateSearch: z.object({
    tab: z.enum(['file', 'link', 'record']).optional().catch(undefined),
  }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: '/library', search: { add: search.tab ?? 'file' }, replace: true })
  },
})
