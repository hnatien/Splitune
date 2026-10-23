// Keyboard diagram (V13 chord chart: left-hand bass, right-hand chord): a piano keyboard with the
// chord's keys pressed, in the keyboard tokens of every appearance. Hands differ in lightness and
// carry an L or R on the key (26 §5: never colour alone); middle C can be labelled so the eye
// finds its place. Keys cross-fade when the chord changes, so the notes two chords share stay lit.
// The svg's width and height are its intrinsic size: set one in CSS and the other follows.

export interface KeyboardDiagramProps {
  /** MIDI pitches pressed by each hand. */
  left: readonly number[]
  right: readonly number[]
  /** Accessible name, e.g. "E♭maj7: left hand E♭, right hand G B♭ D". */
  label: string
  /** First and last key shown (MIDI, both white keys); default C2–C5. */
  from?: number
  to?: number
  /** L and R on the pressed keys. */
  marks?: boolean
  /** Text under middle C (C4), e.g. "C4". */
  middleC?: string | undefined
  className?: string
}

const BLACK = new Set([1, 3, 6, 8, 10])
const W = 10
const H = 48
const BW = 6
const BH = 30
const CAPTION = 9

const fade = { transition: 'fill var(--duration-base) var(--ease-standard)' }

export function KeyboardDiagram({
  left,
  right,
  label,
  from = 36,
  to = 72,
  marks = true,
  middleC,
  className,
}: KeyboardDiagramProps) {
  const whites: { midi: number; x: number }[] = []
  const blacks: { midi: number; x: number }[] = []
  for (let midi = from; midi <= to; midi++) {
    if (BLACK.has(midi % 12)) blacks.push({ midi, x: whites.length * W - BW / 2 })
    else whites.push({ midi, x: whites.length * W })
  }
  const hand = (midi: number) =>
    right.includes(midi) ? 'right' : left.includes(midi) ? 'left' : undefined
  const fill = (midi: number, black: boolean) => {
    const h = hand(midi)
    return h ? `var(--key-${h})` : black ? 'var(--key-black)' : 'var(--key-white)'
  }
  const mark = (midi: number, x: number, width: number, y: number, size: number) => {
    const h = hand(midi)
    if (!marks || !h) return null
    return (
      <text
        x={x + width / 2}
        y={y}
        fontSize={size}
        fontWeight={700}
        textAnchor="middle"
        fill={`var(--key-${h}-fg)`}
      >
        {h === 'right' ? 'R' : 'L'}
      </text>
    )
  }
  const c4 = whites.find((key) => key.midi === 60)
  const height = H + (middleC && c4 ? CAPTION + 2 : 0)
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`-0.5 -0.5 ${whites.length * W + 1} ${height + 1}`}
      width={whites.length * W + 1}
      height={height + 1}
      data-slot="keyboard-diagram"
      className={className}
    >
      {whites.map(({ midi, x }) => (
        <g key={midi} data-midi={midi} data-hand={hand(midi)}>
          <rect
            x={x}
            y={0}
            width={W}
            height={H}
            rx={1.5}
            stroke="var(--staff)"
            strokeWidth={0.6}
            style={{ ...fade, fill: fill(midi, false) }}
          />
          {mark(midi, x, W, H - 4, 6)}
        </g>
      ))}
      {blacks.map(({ midi, x }) => (
        <g key={midi} data-midi={midi} data-hand={hand(midi)}>
          <rect
            x={x}
            y={0}
            width={BW}
            height={BH}
            rx={1}
            stroke="var(--key-black)"
            strokeWidth={0.6}
            style={{ ...fade, fill: fill(midi, true) }}
          />
          {mark(midi, x, BW, BH - 3, 4.5)}
        </g>
      ))}
      {middleC && c4 && (
        <text
          x={c4.x + W / 2}
          y={H + CAPTION}
          fontSize={7}
          textAnchor="middle"
          fill="currentColor"
          aria-hidden
        >
          {middleC}
        </text>
      )}
    </svg>
  )
}
