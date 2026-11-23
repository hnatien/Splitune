import { Link } from '@tanstack/react-router'
import { CopyIcon } from 'lucide-react'
import { useState } from 'react'
import { missingRequirements, probeCapabilities, type Requirement } from '@/lib/capabilities'
import { m } from '@/lib/i18n'
import { Button, buttonVariants } from '@/ui/button'
import { SystemCard, SystemText } from './system-card'

// Unsupported browser (27 §3.11, 24 §1): which hard requirement is missing, in
// plain words; the supported versions under Details; a link to copy into another browser, and the
// way back to the library (still readable without the audio engine).

const NAMES: Record<Requirement, () => string> = {
  audioWorklet: () => m['system.missing_audio_worklet'](),
  wasmSimd: () => m['system.missing_wasm_simd'](),
}

const LIST = new Intl.ListFormat('en', { type: 'conjunction' })

export function UnsupportedBrowser() {
  const missing = missingRequirements(probeCapabilities())
  const listed = missing.length > 0 ? missing : (['audioWorklet', 'wasmSimd'] as Requirement[])
  const [copied, setCopied] = useState(false)
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(new URL('/', window.location.href).href)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  return (
    <SystemCard
      title={m['system.unsupported_title']()}
      actions={
        <>
          <Button variant="primary" onClick={copyLink}>
            <CopyIcon aria-hidden />
            {copied ? m['system.link_copied']() : m['system.copy_link']()}
          </Button>
          <Link to="/library" className={buttonVariants({ variant: 'quiet' })}>
            {m['system.library_still']()}
          </Link>
        </>
      }
    >
      <SystemText>
        {m['system.unsupported']({ missing: LIST.format(listed.map((r) => NAMES[r]())) })}
      </SystemText>
      <details className="group flex flex-col items-center text-body-sm text-muted-foreground">
        <summary className="inline-flex min-h-target cursor-pointer items-center rounded-full px-3 font-medium text-foreground hover:bg-panel">
          {m['system.details']()}
        </summary>
        <p>{m['system.supported_browsers']()}</p>
      </details>
    </SystemCard>
  )
}
