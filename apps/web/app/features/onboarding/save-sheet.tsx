import { useState } from 'react'
import { m } from '@/lib/i18n'
import { useMediaQuery } from '@/lib/use-media-query'
import { Button } from '@/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/ui/dialog'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/ui/drawer'
import { type AuthMode, CredentialsForm } from '../auth/sign-in'

// "Save your progress?" (27 §3.3 step 6): after a completed pass, a username and a password create
// the account (or sign in to an existing one), then /start/saved claims the progress; "Not now"
// keeps practising. Shown only while playback is stopped, so it never interrupts a pass. A centred
// dialog from 640 px, a sheet from the bottom on phones.

export const SAVED_PATH = '/start/saved'

export function SaveSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<AuthMode>('sign-up')
  const wide = useMediaQuery('(min-width: 40rem)')
  const signUp = mode === 'sign-up'
  const form = (
    <div className="flex flex-col gap-6">
      <CredentialsForm key={mode} mode={mode} next={SAVED_PATH} idPrefix="save" />
      <div className="flex flex-col gap-2">
        <p className="flex flex-wrap items-center gap-x-1 text-body-sm text-muted-foreground">
          {signUp ? m['auth.have_account']() : m['auth.new_here']()}
          <Button variant="link" size="sm" onClick={() => setMode(signUp ? 'sign-in' : 'sign-up')}>
            {signUp ? m['auth.sign_in_title']() : m['auth.sign_up_title']()}
          </Button>
        </p>
        <Button variant="quiet" block onClick={onClose}>
          {m['start.not_now']()}
        </Button>
      </div>
    </div>
  )
  if (wide) {
    return (
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent className="gap-6">
          <DialogHeader>
            <DialogTitle>{m['start.save_title']()}</DialogTitle>
            <DialogDescription>{m['start.save_body']()}</DialogDescription>
          </DialogHeader>
          {form}
        </DialogContent>
      </Dialog>
    )
  }
  return (
    <Drawer open={open} onOpenChange={(next) => !next && onClose()} swipeDirection="down">
      <DrawerContent>
        <div className="flex min-h-0 flex-col gap-6 overflow-y-auto">
          <DrawerHeader>
            <DrawerTitle>{m['start.save_title']()}</DrawerTitle>
            <DrawerDescription>{m['start.save_body']()}</DrawerDescription>
          </DrawerHeader>
          <div className="px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">{form}</div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
