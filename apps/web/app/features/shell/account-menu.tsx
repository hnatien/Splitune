import { useQueryClient } from '@tanstack/react-query'
import { Link, useRouter } from '@tanstack/react-router'
import { CircleUserIcon } from 'lucide-react'
import { appearanceLabel } from '@/lib/appearance'
import { authClient } from '@/lib/auth-client'
import { useDisplay } from '@/lib/display-store'
import { m } from '@/lib/i18n'
import { Button } from '@/ui/button'
import type { DisplayPreferences } from '@/ui/display'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu'

const APPEARANCES: DisplayPreferences['appearance'][] = ['system', 'light', 'dark', 'stage']

// Account menu (27 §1): Settings · Plan & billing · Keyboard & pedal · Appearance · Help · Sign out.
export function AccountMenu({ email }: { email: string }) {
  const appearance = useDisplay((s) => s.appearance)
  const update = useDisplay((s) => s.update)
  const router = useRouter()
  const queryClient = useQueryClient()

  const signOut = async () => {
    await authClient.signOut()
    queryClient.clear()
    await router.navigate({ to: '/' })
    await router.invalidate()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label={m['nav.account']()} />}
      >
        <CircleUserIcon aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
          <DropdownMenuItem render={<Link to="/settings/profile" />}>
            {m['nav.settings']()}
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link to="/settings/billing" />}>
            {m['nav.plan']()}
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link to="/settings/keyboard" />}>
            {m['nav.keyboard']()}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>{m['nav.appearance']()}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={appearance}
            onValueChange={(value) =>
              update({ appearance: value as DisplayPreferences['appearance'] })
            }
          >
            {APPEARANCES.map((choice) => (
              <DropdownMenuRadioItem key={choice} value={choice} closeOnClick={false}>
                {appearanceLabel(choice)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>{m['nav.help']()}</DropdownMenuLabel>
          <DropdownMenuItem render={<Link to="/how-it-works" />}>
            {m['nav.how_it_works']()}
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link to="/pricing" />}>{m['nav.pricing']()}</DropdownMenuItem>
          <DropdownMenuItem render={<Link to="/legal/$page" params={{ page: 'terms' }} />}>
            {m['legal.terms_title']()}
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link to="/legal/$page" params={{ page: 'privacy' }} />}>
            {m['legal.privacy_title']()}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut}>{m['nav.sign_out']()}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
