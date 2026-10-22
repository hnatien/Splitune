import { MailIcon } from 'lucide-react'
import type * as React from 'react'
import { useId, useState } from 'react'
import { z } from 'zod'
import { MAGIC_LINK_MINUTES } from '@/lib/auth-client'
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
import { Field, FieldError, FieldLabel } from '@/ui/field'
import { Input } from '@/ui/input'
import { InlineError } from '@/ui/status-message'
import { sendLink } from '../auth/sign-in'

// "Save your progress?" (27 §3.3 step 6): after a completed pass, an email field and Continue
// (the magic link signs in or creates the account, then /start/saved claims the progress); "Not
// now" keeps practising. Shown only while playback is stopped, so it never interrupts a pass.

const Email = z.email()
export const SAVED_PATH = '/start/saved'

export function SaveSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [failure, setFailure] = useState<string | undefined>()
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState<string | undefined>()
  const errorId = useId()

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const value = email.trim()
    if (!Email.safeParse(value).success) {
      setInvalid(true)
      return
    }
    setSending(true)
    setFailure(undefined)
    const problem = await sendLink(value, SAVED_PATH)
    setSending(false)
    if (problem) setFailure(problem)
    else setSentTo(value)
  }

  return (
    <Drawer open={open} onOpenChange={(next) => !next && onClose()} swipeDirection="down">
      <DrawerContent>
        <div className="mx-auto flex w-full max-w-md flex-col">
          {sentTo ? (
            <>
              <DrawerHeader>
                <DrawerTitle>{m['auth.check_title']()}</DrawerTitle>
                <DrawerDescription>
                  {m['auth.link_sent']({ email: sentTo, minutes: String(MAGIC_LINK_MINUTES) })}
                </DrawerDescription>
              </DrawerHeader>
              <DrawerFooter>
                <Button variant="ghost" onClick={() => setSentTo(undefined)}>
                  {m['auth.use_different']()}
                </Button>
                <Button onClick={onClose}>{m['start.keep_practising']()}</Button>
              </DrawerFooter>
            </>
          ) : (
            <form noValidate onSubmit={submit}>
              <DrawerHeader>
                <DrawerTitle>{m['start.save_title']()}</DrawerTitle>
                <DrawerDescription>{m['start.save_body']()}</DrawerDescription>
              </DrawerHeader>
              <div className="flex flex-col gap-4 px-6 pb-4">
                <Field data-invalid={invalid || undefined}>
                  <FieldLabel htmlFor="save-email">{m['auth.email_label']()}</FieldLabel>
                  <Input
                    id="save-email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    aria-invalid={invalid || undefined}
                    aria-describedby={invalid ? errorId : undefined}
                    onChange={(event) => {
                      setEmail(event.target.value)
                      setInvalid(false)
                    }}
                  />
                  {invalid && <FieldError id={errorId}>{m['auth.email_invalid']()}</FieldError>}
                </Field>
                {failure && <InlineError title={failure} />}
              </div>
              <DrawerFooter>
                <Button type="submit" variant="primary" loading={sending}>
                  <MailIcon aria-hidden />
                  {m['start.continue']()}
                </Button>
                <Button variant="ghost" onClick={onClose}>
                  {m['start.not_now']()}
                </Button>
              </DrawerFooter>
            </form>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
