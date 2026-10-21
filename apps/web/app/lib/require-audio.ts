import { redirect } from '@tanstack/react-router'
import { missingRequirements, probeCapabilities } from '@/lib/capabilities'

/** Route guard for screens that need the audio engine (24 §2): AudioWorklet and WASM SIMD. */
export function requireAudioEngine() {
  if (typeof window === 'undefined') return
  if (missingRequirements(probeCapabilities()).length > 0) throw redirect({ to: '/unsupported' })
}
