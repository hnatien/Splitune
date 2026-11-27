import { Link } from '@tanstack/react-router'
import {
  BookOpenIcon,
  ChevronsUpDownIcon,
  FileTextIcon,
  GaugeIcon,
  KeyboardIcon,
  LogOutIcon,
  MonitorSmartphoneIcon,
  MoonIcon,
  SettingsIcon,
  ShieldIcon,
  SunIcon,
  TagIcon,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { appearanceLabel } from '@/lib/appearance'
import { useDisplay } from '@/lib/display-store'
import { m } from '@/lib/i18n'
import type { MeData } from '@/lib/session'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'
import type { DisplayPreferences } from '@/ui/display'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSegment,
  DropdownMenuSegments,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import { UsagePopover } from './usage-popover'
import { useSignOut } from './use-sign-out'

/** The three appearance choices (D2): `stage` stays a valid id but isn't offered here. */
export const APPEARANCES: DisplayPreferences['appearance'][] = ['dark', 'light', 'system']

export const APPEARANCE_ICON = { dark: MoonIcon, light: SunIcon, system: MonitorSmartphoneIcon }

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
function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    // The initials are a picture of the account, not its label (WCAG 2.5.3): painted from an
    // attribute so the trigger's only text is its name.
    <span
      aria-hidden
      data-initials={initials(name)}
      className={cn(
        'grid size-7 shrink-0 place-items-center rounded-full text-label-sm text-foreground inset-ring inset-ring-border-strong before:content-[attr(data-initials)]',
        className,
      )}
    />
  )
}

const ICON = 'text-muted-foreground'

// Account menu (27 §1): in the rail a row with the initials and the name; in the phone and tablet
// top bar a 44 px circle. The menu leads with the account (initials, name and the username it signs
// in with) and the appearance as a row of three icons, then Settings · Usage (its popover, from this
// control) · Keyboard & pedal, the help pages and Sign out: every row led by its icon, groups split by hairlines rather than headings.
export function AccountMenu({
  me,
  name,
  username,
  layout = 'icon',
}: {
  me: MeData
  name: string
  username?: string | null | undefined
  layout?: 'icon' | 'rail'
}) {
  const appearance = useDisplay((s) => s.appearance)
  const update = useDisplay((s) => s.update)
  const signOut = useSignOut()
  const chosen = appearance === 'stage' ? 'dark' : appearance
  const trigger = useRef<HTMLButtonElement>(null)
  // Usage opens once the menu has finished closing, so the menu handing focus back to its trigger
  // can't pull it out of the popover.
  const usageNext = useRef(false)
  const [usage, setUsage] = useState(false)

  return (
    <>
      <DropdownMenu
        onOpenChangeComplete={(open) => {
          if (open || !usageNext.current) return
          usageNext.current = false
          setUsage(true)
        }}
      >
        <DropdownMenuTrigger
          ref={trigger}
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
            <DropdownMenuLabel className="flex items-center gap-3 pt-3 pb-2">
              <Avatar name={name} className="size-8" />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-label text-foreground">{name}</span>
                {username && username !== name && (
                  <span className="truncate text-caption text-muted-foreground">{username}</span>
                )}
              </span>
            </DropdownMenuLabel>
            <div className="px-3 pb-2">
              <DropdownMenuSegments
                aria-label={m['nav.appearance']()}
                value={chosen}
                onValueChange={(value) =>
                  update({ appearance: value as DisplayPreferences['appearance'] })
                }
              >
                {APPEARANCES.map((choice) => {
                  const Icon = APPEARANCE_ICON[choice as keyof typeof APPEARANCE_ICON]
                  return (
                    <DropdownMenuSegment
                      key={choice}
                      value={choice}
                      label={appearanceLabel(choice)}
                      closeOnClick={false}
                    >
                      <Icon aria-hidden />
                    </DropdownMenuSegment>
                  )
                })}
              </DropdownMenuSegments>
            </div>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem render={<Link to="/settings/account" />}>
              <SettingsIcon aria-hidden className={ICON} />
              {m['nav.settings']()}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                usageNext.current = true
              }}
            >
              <GaugeIcon aria-hidden className={ICON} />
              {m['nav.usage']()}
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link to="/settings/keyboard" />}>
              <KeyboardIcon aria-hidden className={ICON} />
              {m['nav.keyboard']()}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup aria-label={m['nav.help']()}>
            <DropdownMenuItem render={<Link to="/how-it-works" />}>
              <BookOpenIcon aria-hidden className={ICON} />
              {m['nav.how_it_works']()}
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link to="/pricing" />}>
              <TagIcon aria-hidden className={ICON} />
              {m['nav.pricing']()}
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link to="/legal/$page" params={{ page: 'terms' }} />}>
              <FileTextIcon aria-hidden className={ICON} />
              {m['legal.terms_title']()}
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link to="/legal/$page" params={{ page: 'privacy' }} />}>
              <ShieldIcon aria-hidden className={ICON} />
              {m['legal.privacy_title']()}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut}>
            <LogOutIcon aria-hidden className={ICON} />
            {m['nav.sign_out']()}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <UsagePopover
        me={me}
        anchor={trigger}
        side={layout === 'rail' ? 'right' : 'bottom'}
        open={usage}
        onOpenChange={setUsage}
      />
    </>
  )
}
