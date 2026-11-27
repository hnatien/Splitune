import { PlusIcon } from 'lucide-react'
import { m } from '@/lib/i18n'
import { Kbd } from '@/ui/kbd'
import { ADD_SONG_KEY, useOpenAddSong } from '../import/add-song-state'

// The last tile of the library (27 §3.5): where the next song goes. The drop target's own look (a
// dashed --edge and no fill, as in Add song's file zone) at a tile's size, saying what the page
// takes; pressing it opens Add song. Wide screens show the key that does the same.
export function AddSongTile({ wide }: { wide: boolean }) {
  const openAddSong = useOpenAddSong()
  return (
    <li data-slot="add-song-tile" className="flex min-w-0">
      <button
        type="button"
        aria-keyshortcuts={ADD_SONG_KEY}
        onClick={() => openAddSong()}
        className="flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-media border border-dashed border-edge px-6 text-center transition-colors duration-(--duration-fast) hover:bg-hover active:bg-pressed"
      >
        <span className="mb-1.5 grid size-9 place-items-center rounded-full inset-ring inset-ring-border-strong">
          <PlusIcon aria-hidden className="size-4.5 stroke-[1.8]" />
        </span>
        <span className="flex items-center gap-2 text-label text-foreground">
          {m['library.add_tile']()}
          {wide && <Kbd>{ADD_SONG_KEY}</Kbd>}
        </span>
        <span className="max-w-56 text-caption text-pretty text-muted-foreground">
          {wide ? m['library.empty_body']() : m['library.empty_body_phone']()}
        </span>
      </button>
    </li>
  )
}
