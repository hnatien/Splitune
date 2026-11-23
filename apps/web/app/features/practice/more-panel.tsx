import { Link } from '@tanstack/react-router'
import { KeyboardIcon, PencilRulerIcon, SearchIcon, SettingsIcon, VideoIcon } from 'lucide-react'
import { m } from '@/lib/i18n'
import { Button, buttonVariants } from '@/ui/button'
import { PopoverContent } from '@/ui/popover-content'
import { usePalette } from '../shell/palette-store'
import { usePracticeUi } from './practice-store'
import { useVideoUrl } from './video-url'

// The ⋯ popover (27 §3.7.1, §3.7.2): Keyboard shortcuts everywhere, Open full editor on desktop
// (signed in), search on phones (where the top bar has no room for its button), the floating
// video player when the song has a downloaded video (closed by default), and Keyboard & pedal
// settings.
export function MorePanel({
  desktop,
  editor,
  songId,
}: {
  desktop: boolean
  /** The desktop editor needs an account (not for a visitor's example song). */
  editor: boolean
  songId: string
}) {
  const video = useVideoUrl()
  const videoOpen = usePracticeUi((s) => s.videoOpen)
  return (
    <PopoverContent align="end" aria-label={m['practice.more']()} className="w-64 gap-1 p-2">
      <Button
        variant="quiet"
        className="justify-start"
        onClick={() => usePracticeUi.setState({ shortcutsOpen: true })}
      >
        <KeyboardIcon aria-hidden />
        {m['practice.shortcuts']()}
      </Button>
      {desktop && editor && (
        <Link
          to="/songs/$songId/edit"
          params={{ songId }}
          className={buttonVariants({ variant: 'quiet', className: 'justify-start' })}
        >
          <PencilRulerIcon aria-hidden />
          {m['practice.open_editor']()}
        </Link>
      )}
      {!desktop && editor && (
        <Button
          variant="quiet"
          className="justify-start sm:hidden"
          onClick={() => usePalette.getState().setOpen(true)}
        >
          <SearchIcon aria-hidden />
          {m['nav.search']()}
        </Button>
      )}
      {video.data && (
        <Button
          variant={videoOpen ? 'selected' : 'quiet'}
          className="justify-start"
          aria-pressed={videoOpen}
          onClick={() => usePracticeUi.setState({ videoOpen: !videoOpen })}
        >
          <VideoIcon aria-hidden />
          {m['practice.video']()}
        </Button>
      )}
      <Link
        to="/settings/keyboard"
        className={buttonVariants({ variant: 'quiet', className: 'justify-start' })}
      >
        <SettingsIcon aria-hidden />
        {m['nav.keyboard']()}
      </Link>
    </PopoverContent>
  )
}
