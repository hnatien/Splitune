import { createFileRoute } from '@tanstack/react-router'
import { AboutSettings } from '@/features/settings/about-settings'

// About (27 §3.9): version, models, font licences, the provenance register.
export const Route = createFileRoute('/_app/settings/about')({ component: AboutSettings })
