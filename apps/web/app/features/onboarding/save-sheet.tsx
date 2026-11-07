import { useState } from 'react'
import { m } from '@/lib/i18n'
import { Button } from '@/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/ui/drawer'
import { type AuthMode, CredentialsForm } from '../auth/sign-in'

// "Save your progress?" (27 §3.3 step 6): after a completed pass, a username and a password create
// the account (or sign in to an existing one), then /start/saved claims the progress; "Not now"
// keeps practising. Shown only while playback is stopped, so it never interrupts a pass.

export const SAVED_PATH = '/start/saved'

export function SaveSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<AuthMode>('sign-up')
  const signUp = mode === 'sign-up'
  return (
    <Drawer open={open} onOpenChange={(next) => !next && onClose()} swipeDirection="down">
      <DrawerContent>
        <div className="mx-auto flex w-full max-w-md flex-col">
          <DrawerHeader>
            <DrawerTitle>{m['start.save_title']()}</DrawerTitle>
            <DrawerDescription>{m['start.save_body']()}</DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col gap-4 px-6 pb-4">
            <CredentialsForm key={mode} mode={mode} next={SAVED_PATH} idPrefix="save" />
            <p className="text-sm text-muted-foreground">
              {signUp ? m['auth.have_account']() : m['auth.new_here']()}{' '}
              <Button
                variant="link"
                // Inline in the sentence, with a 44 px tall hit area for fingers (26 §8).
                className="relative min-h-0 px-0 align-baseline text-sm after:absolute after:inset-x-0 after:top-1/2 after:h-target after:-translate-y-1/2"
                onClick={() => setMode(signUp ? 'sign-in' : 'sign-up')}
              >
                {signUp ? m['auth.sign_in_title']() : m['auth.sign_up_title']()}
              </Button>
            </p>
          </div>
          <DrawerFooter>
            <Button variant="ghost" onClick={onClose}>
              {m['start.not_now']()}
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
