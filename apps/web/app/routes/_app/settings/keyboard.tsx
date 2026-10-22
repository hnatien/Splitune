import { createFileRoute } from '@tanstack/react-router'
import { KeyboardSettings } from '@/features/settings/keyboard-settings'

// Settings → Keyboard & pedal (27 §3.9, 12 §8).
export const Route = createFileRoute('/_app/settings/keyboard')({ component: KeyboardSettings })
