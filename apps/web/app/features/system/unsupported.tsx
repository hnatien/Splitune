import { Link } from '@tanstack/react-router'
import { CheckIcon, ChevronDownIcon, CopyIcon } from 'lucide-react'
import { useState } from 'react'
import { missingRequirements, probeCapabilities, type Requirement } from '@/lib/capabilities'
import { m } from '@/lib/i18n'
import { Button, buttonVariants } from '@/ui/button'
import { SystemMessage, SystemText, useSignedIn } from './system-message'

// Unsupported browser (27 §3.11, 24 §1): which hard requirement is missing, in plain words; the
// supported versions under Details, a disclosure that looks and reads as one (a chevron that
// turns, the open state from <details>); "Copy link" to open Splitune in another browser as the
// one primary; and the way back: the library when signed in (it still reads without the audio
// engine), the home page when not.

const NAMES: Record<Requirement, () => string> = {
  audioWorklet: () => m['system.missing_audio_worklet'](),
  wasmSimd: () => m['system.missing_wasm_simd'](),
}

const LIST = new Intl.ListFormat('en', { type: 'conjunction' })

export function UnsupportedBrowser() {
  const signedIn = useSignedIn()
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
    <SystemMessage
      title={m['system.unsupported_title']()}
      actions={
        <>
          <Button variant="primary" onClick={copyLink}>
            {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
            {copied ? m['system.link_copied']() : m['system.copy_link']()}
          </Button>
          {signedIn ? (
            <Link to="/library" className={buttonVariants({ variant: 'quiet' })}>
              {m['system.library_still']()}
            </Link>
          ) : (
            <Link to="/" className={buttonVariants({ variant: 'quiet' })}>
              {m['privacy.go_home']()}
            </Link>
          )}
        </>
      }
    >
      <SystemText>
        {m['system.unsupported']({ missing: LIST.format(listed.map((r) => NAMES[r]())) })}
      </SystemText>
      <details className="group/details flex flex-col items-start gap-1">
        <summary
          className={buttonVariants({
            variant: 'quiet',
            size: 'sm',
            className:
              'w-fit cursor-pointer list-none text-foreground [&::-webkit-details-marker]:hidden',
          })}
        >
          {m['system.details']()}
          <ChevronDownIcon
            aria-hidden
            className="transition-transform duration-(--duration-base) ease-standard group-open/details:rotate-180"
          />
        </summary>
        <p className="text-body-sm text-pretty text-muted-foreground">
          {m['system.supported_browsers']()}
        </p>
      </details>
    </SystemMessage>
  )
}
