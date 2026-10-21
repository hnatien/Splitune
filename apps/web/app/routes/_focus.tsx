import { createFileRoute, Outlet } from '@tanstack/react-router'

// Focus shell routes (onboarding, practice, edit) render their own FocusShell with the page's
// status bar content.
export const Route = createFileRoute('/_focus')({ component: Outlet })
