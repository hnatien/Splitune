import { CopyIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { canAddToHomeScreen, usePlaybackActive, usePwa } from '@/lib/app-state'
import { isInAppBrowser } from '@/lib/capabilities'
import { m } from '@/lib/i18n'
import { useOnline } from '@/lib/use-online'
import { Button } from '@/ui/button'
import { Banner } from '@/ui/status-message'

const INSTALL_HINT_KEY = 'splitune.install-hint'

// Page-level notices every shell shows (27 §3.11): offline, the in-app-browser hint and "A new
// version is ready" (held back while audio plays, so a reload never cuts into practice). The app
// shell adds the iOS "Add to Home Screen" hint. The UA is read only for the in-app banner
// (24 §4), after hydration so server and client markup match.
export function SystemBanners({ installHint = false }: { installHint?: boolean }) {
  const online = useOnline()
  const [inApp, setInApp] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [addToHome, setAddToHome] = useState(false)
  const updateReady = usePwa((s) => s.updateReady)
  const applyUpdate = usePwa((s) => s.applyUpdate)
  const playing = usePlaybackActive((s) => s.active)
  useEffect(() => setInApp(isInAppBrowser(navigator.userAgent)), [])
  useEffect(() => {
    if (installHint) setAddToHome(canAddToHomeScreen() && !storedFlag(INSTALL_HINT_KEY))
  }, [installHint])

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
      {updateReady && !playing && (
        <Banner
          tone="info"
          title={m['system.update_ready']()}
          actions={
            <Button variant="primary" onClick={applyUpdate}>
              {m['system.reload']()}
            </Button>
          }
        />
      )}
      {addToHome && !inApp && (
        <Banner
          tone="info"
          title={m['system.install_ios']()}
          dismiss={{
            label: m['system.dismiss'](),
            onDismiss: () => {
              setFlag(INSTALL_HINT_KEY)
              setAddToHome(false)
            },
          }}
        />
      )}
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

function storedFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function setFlag(key: string) {
  try {
    localStorage.setItem(key, '1')
  } catch {
    // Not remembered: the hint comes back on the next visit.
  }
}
