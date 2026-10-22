// Chord diagram (07 §6 chords_only level: "chord strip + diagrams"): a fretboard box in chart
// orientation (low string on the left, nut at the top), in the current ink. Left-handed players
// get the mirror image (12 §3: diagrams and fretboards mirror; tab text doesn't).

export interface ChordDiagramProps {
  /** Index 0 = string 1 (highest); frets relative to the capo; null = not played. */
  frets: readonly (number | null)[]
  /** Accessible name, e.g. "Am chord: x 0 2 2 1 0". */
  label: string
  mirrored?: boolean
  className?: string
}

const ROWS = 4
const W = 60
const H = 72
const TOP = 14

export function ChordDiagram({ frets, label, mirrored = false, className }: ChordDiagramProps) {
  const strings = frets.length
  // Chart order: lowest string first.
  const chart = [...frets].reverse()
  const played = chart.filter((f): f is number => f !== null && f > 0)
  const lowest = played.length > 0 ? Math.min(...played) : 1
  const base = Math.max(...played, 0) > ROWS ? lowest : 1
  const gap = (W - 12) / Math.max(1, strings - 1)
  const rowH = (H - TOP - 6) / ROWS
  const x = (i: number) => 6 + (mirrored ? strings - 1 - i : i) * gap
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${W} ${H}`}
      data-slot="chord-diagram"
      data-mirrored={mirrored || undefined}
      className={className}
    >
      <g stroke="currentColor" strokeWidth={1} fill="none">
        {chart.map((_, i) => {
          const at = x(i)
          return <line key={`string-${at}`} x1={at} y1={TOP} x2={at} y2={TOP + ROWS * rowH} />
        })}
        {Array.from({ length: ROWS + 1 }, (_, r) => (
          <line
            // biome-ignore lint/suspicious/noArrayIndexKey: frets are positional
            key={r}
            x1={6}
            x2={W - 6}
            y1={TOP + r * rowH}
            y2={TOP + r * rowH}
            strokeWidth={r === 0 && base === 1 ? 3 : 1}
          />
        ))}
      </g>
      {base > 1 && (
        <text
          x={mirrored ? W - 1 : 1}
          y={TOP + rowH * 0.7}
          fontSize={8}
          fill="currentColor"
          textAnchor={mirrored ? 'end' : 'start'}
        >
          {base}
        </text>
      )}
      {chart.map((fret, i) => {
        const cx = x(i)
        if (fret === null) {
          return (
            <text
              key={`mark-${cx}`}
              x={cx}
              y={TOP - 4}
              fontSize={8}
              textAnchor="middle"
              fill="currentColor"
            >
              ×
            </text>
          )
        }
        if (fret === 0) {
          return (
            <circle
              key={`mark-${cx}`}
              cx={cx}
              cy={TOP - 7}
              r={2.5}
              fill="none"
              stroke="currentColor"
            />
          )
        }
        return (
          <circle
            key={`mark-${cx}`}
            cx={cx}
            cy={TOP + (fret - base + 0.5) * rowH}
            r={3.5}
            fill="currentColor"
          />
        )
      })}
    </svg>
  )
}
