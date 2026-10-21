import { createFileRoute } from '@tanstack/react-router'
import { DisplaySettings } from '@/features/settings/display-settings'

export const Route = createFileRoute('/_app/settings/display')({ component: DisplaySettings })
