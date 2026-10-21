import { createFileRoute } from '@tanstack/react-router'
import { Home } from '@/features/marketing/home'

export const Route = createFileRoute('/_marketing/')({ component: Home })
