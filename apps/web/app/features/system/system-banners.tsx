import { CopyIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { isInAppBrowser } from '@/lib/capabilities'
import { m } from '@/lib/i18n'
import { useOnline } from '@/lib/use-online'
import { Button } from '@/ui/button'
import { Banner } from '@/ui/status-message'

// Page-level notices every shell shows (27 §3.11): offline, and the in-app-browser hint. The UA is
// read only for this banner (24 §4), after hydration so server and client markup match.
export function SystemBanners() {
  const online = useOnline()
  const [inApp, setInApp] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [copied, setCopied] = useState(false)
  useEffect(() => setInApp(isInAppBrowser(navigator.userAgent)), [])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <>
      {!online && <Banner tone="warning" title={m['system.offline']()} />}
      {inApp && !dismissed && (
        <Banner
          tone="info"
          title={m['system.in_app_browser']()}
          description={m['system.in_app_browser_hint']()}
          actions={
            <Button variant="outline" onClick={copyLink}>
              <CopyIcon aria-hidden />
              {copied ? m['system.link_copied']() : m['system.copy_link']()}
            </Button>
          }
          dismiss={{ label: m['system.dismiss'](), onDismiss: () => setDismissed(true) }}
        />
      )}
    </>
  )
}
