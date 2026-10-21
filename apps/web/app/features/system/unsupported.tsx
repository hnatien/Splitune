import { Link } from '@tanstack/react-router'
import { MonitorXIcon } from 'lucide-react'
import { missingRequirements, probeCapabilities, type Requirement } from '@/lib/capabilities'
import { m } from '@/lib/i18n'
import { buttonVariants } from '@/ui/button'
import { EmptyState } from '@/ui/empty-state'

// Unsupported browser (27 §3.11, 24 §1): which hard requirement is missing, in plain words, the
// supported browsers, and the way back to the library (still readable without the audio engine).

const NAMES: Record<Requirement, () => string> = {
  audioWorklet: () => m['system.missing_audio_worklet'](),
  wasmSimd: () => m['system.missing_wasm_simd'](),
}

export function UnsupportedBrowser() {
  const missing = missingRequirements(probeCapabilities())
  const listed = missing.length > 0 ? missing : (['audioWorklet', 'wasmSimd'] as Requirement[])
  return (
    <EmptyState
      icon={<MonitorXIcon aria-hidden />}
      title={m['system.unsupported_title']()}
      description={`${m['system.unsupported']({ missing: listed.map((r) => NAMES[r]()).join(', ') })} ${m['system.supported_browsers']()}`}
      action={
        <Link to="/library" className={buttonVariants({ variant: 'primary' })}>
          {m['system.library_still']()}
        </Link>
      }
    />
  )
}
