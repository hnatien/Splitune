import { Link } from '@tanstack/react-router'
import { appearanceLabel } from '@/lib/appearance'
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
import { useSignOut } from './use-sign-out'

/** The three appearance choices (D2): `stage` stays a valid id but isn't offered here. */
export const APPEARANCES: DisplayPreferences['appearance'][] = ['dark', 'light', 'system']

/** "Tien Hoang" → "TH", "Ana" → "A". */
export function initials(name: string): string {
  const words = name
    .trim()
    .split(/[\s@._-]+/)
    .filter(Boolean)
  const letters = words.length > 1 ? [words[0], words[1]] : [words[0]]
  return letters
    .map((word) => (word ? Array.from(word)[0] : ''))
    .join('')
    .toLocaleUpperCase()
}

// Account menu (27 §1): a 40 px avatar with the initials; the username (the email for a Google-only
// account), then Settings · Keyboard & pedal · Appearance · Help · Sign out.
export function AccountMenu({ name }: { name: string }) {
  const appearance = useDisplay((s) => s.appearance)
  const update = useDisplay((s) => s.update)
  const signOut = useSignOut()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="box"
            size="icon"
            aria-label={m['nav.account']()}
            className="font-bold text-foreground [--r:var(--radius-5xl)]"
          />
        }
      >
        <span aria-hidden>{initials(name)}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="truncate">{name}</DropdownMenuLabel>
          <DropdownMenuItem render={<Link to="/settings/profile" />}>
            {m['nav.settings']()}
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link to="/settings/keyboard" />}>
            {m['nav.keyboard']()}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>{m['nav.appearance']()}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={appearance === 'stage' ? 'dark' : appearance}
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
