import { Link } from '@tanstack/react-router'
import { ChevronsUpDownIcon } from 'lucide-react'
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

/** The initials in a hairline circle: a picture of the account, painted from an attribute. */
function Avatar({ name }: { name: string }) {
  return (
    // The initials are a picture of the account, not its label (WCAG 2.5.3): painted from an
    // attribute so the trigger's only text is its name.
    <span
      aria-hidden
      data-initials={initials(name)}
      className="grid size-7 shrink-0 place-items-center rounded-full text-label-sm text-foreground inset-ring inset-ring-border-strong before:content-[attr(data-initials)]"
    />
  )
}

// Account menu (27 §1): in the rail a row with the initials and the name; in the phone and tablet
// top bar a 44 px circle. The menu leads with the name (and the username under it, which is how
// the account signs in), then Settings · Keyboard & pedal · Appearance · Help · Sign out.
export function AccountMenu({
  name,
  username,
  layout = 'icon',
}: {
  name: string
  username?: string | null | undefined
  layout?: 'icon' | 'rail'
}) {
  const appearance = useDisplay((s) => s.appearance)
  const update = useDisplay((s) => s.update)
  const signOut = useSignOut()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          layout === 'rail' ? (
            <button
              type="button"
              className="flex min-h-target w-full items-center gap-3 rounded-field px-2 text-left text-label text-foreground transition-colors duration-(--duration-fast) hover:bg-hover data-popup-open:bg-hover focus-visible:-outline-offset-2"
            />
          ) : (
            <Button variant="quiet" size="icon" aria-label={m['nav.account']()} />
          )
        }
      >
        <Avatar name={name} />
        {layout === 'rail' && (
          <>
            <span className="min-w-0 flex-1 truncate">
              <span className="sr-only">{m['nav.account']()}, </span>
              {name}
            </span>
            <ChevronsUpDownIcon aria-hidden className="size-4 shrink-0 text-faint-foreground" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={layout === 'rail' ? 'start' : 'end'}
        side={layout === 'rail' ? 'top' : 'bottom'}
        className="w-64"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="truncate text-label text-foreground">{name}</span>
            {username && username !== name && (
              <span className="truncate text-caption text-muted-foreground">{username}</span>
            )}
          </DropdownMenuLabel>
          <DropdownMenuItem render={<Link to="/settings/account" />}>
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
