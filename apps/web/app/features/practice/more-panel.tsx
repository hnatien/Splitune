import { Link } from '@tanstack/react-router'
import { KeyboardIcon, PencilRulerIcon, SettingsIcon, VideoIcon } from 'lucide-react'
import { m } from '@/lib/i18n'
import { Button, buttonVariants } from '@/ui/button'
import { PopoverContent } from '@/ui/popover-content'
import { usePracticeUi } from './practice-store'
import { useVideoUrl } from './video-url'

// The ⋯ popover (27 §3.7.1, §3.7.2): Keyboard shortcuts and Open full editor on desktop (signed
// in), the floating video player when the song has a downloaded video (closed by default), and
// Keyboard & pedal settings.
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
      {desktop && (
        <>
          <Button
            variant="ghost"
            className="justify-start"
            onClick={() => usePracticeUi.setState({ shortcutsOpen: true })}
          >
            <KeyboardIcon aria-hidden />
            {m['practice.shortcuts']()}
          </Button>
          {editor && (
            <Link
              to="/songs/$songId/edit"
              params={{ songId }}
              className={buttonVariants({ variant: 'ghost', className: 'justify-start' })}
            >
              <PencilRulerIcon aria-hidden />
              {m['practice.open_editor']()}
            </Link>
          )}
        </>
      )}
      {video.data && (
        <Button
          variant={videoOpen ? 'on' : 'ghost'}
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
        className={buttonVariants({ variant: 'ghost', className: 'justify-start' })}
      >
        <SettingsIcon aria-hidden />
        {m['nav.keyboard']()}
      </Link>
    </PopoverContent>
  )
}
