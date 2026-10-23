import { chordShapes, transposeChord } from '@splitune/music-core'
import { ChordDiagram } from '@splitune/notation'
import { useQuery } from '@tanstack/react-query'
import { m } from '@/lib/i18n'
import { meQuery } from '@/lib/session'

// A chord's easiest guitar shape as a diagram (07 §6): frets relative to the capo, mirrored for
// left-handed players (12 §3). Loads on demand with the chord strip and the chord sheet, outside
// the route's JS budget (12 §10).
export function ChordShape({
  label,
  name,
  capo,
  className,
}: {
  /** Harte label, e.g. "A:min7". */
  label: string
  /** Display name, e.g. "Am7". */
  name: string
  capo: number
  className: string
}) {
  const me = useQuery(meQuery)
  const shape = chordShapes(transposeChord(label, -capo))[0]
  if (!shape) return null
  return (
    <ChordDiagram
      className={className}
      frets={shape.frets}
      mirrored={me.data?.handedness === 'left'}
      label={m['editor.diagram']({ chord: name })}
    />
  )
}
