import { useEffect, useId, useRef } from 'react'
import { type FretWindow, INLAYS, rowAt, spaceAt, stringRows, wireAt } from './fretboard.ts'

// The neck beside the guitar and bass Notes lanes (step 18b): strings in tab order (string 1 on
// top) on the lanes' rows, so each lane runs on into its string; a window of five to nine frets
// spaced like a real neck, the nut or capo when it starts at the first fret. Fingers sounding now
// are ink dots with their fret number, as on chord diagrams, ringed in the instrument's hue; the
// next shape shows faintly (dashed) so the hand can move early, and a cue names the fret when the
// next note leaves the window. Strings differ by position and name, never colour (26 §4.4).
// Moving to a new window glides (--duration-slow, standard easing; none with reduced motion, nor
// after a seek); left-handed players get the mirror image, numbers unmirrored (12 §3). The svg is
// drawn in CSS pixels at its given size.

export interface FretPosition {
  /** 1 = the highest string. */
  string: number
  /** Relative to the capo; 0 = open. */
  fret: number
  /** Part of the strum that just landed (its dot rings once). */
  landed?: boolean
}

export interface FretboardDiagramProps {
  /** String names, string 1 (the highest) first: "e", "B", "G", "D", "A", "E". */
  names: readonly string[]
  window: FretWindow
  /** Size in CSS px; the rows follow `stringRows(height, names.length, readPx)`, as the lanes'. */
  width: number
  height: number
  readPx: number
  /** Fret and string label size in px. */
  numberPx: number
  sounding: readonly FretPosition[]
  next: readonly FretPosition[]
  /** The next note's fret when the window doesn't hold it, with its label ("Fret 12"). */
  shift?: { fret: number; label: string } | undefined
  capo?: number
  /** Left-handed: the neck mirrored; the numbers read normally. */
  mirrored?: boolean
  /** Moves to a new window at once (after a seek) instead of gliding. */
  instant?: boolean
  /** Changes each time a strum lands and may be acknowledged (≤ 3 a second, 26 §10): its `landed`
   * dots ring once. Undefined: no acknowledgement (reduced motion). */
  landing?: number | undefined
  /** The instrument's mark on the score: `var(--fret-guitar)` or `var(--fret-bass)`. */
  accent: string
  /** Accessible name: what sounds now. */
  label: string
  className?: string
}

const WIRES = Array.from({ length: 25 }, (_, wire) => wire)
const RING: Keyframe[] = [
  { transform: 'scale(1)', opacity: 0.55 },
  { transform: 'scale(1.6)', opacity: 0 },
]

// A small ring that grows and fades once when mounted (240 ms), the landing acknowledgement: well
// under 20 mm and a small luminance change (26 §10). Web Animations start on mount, where SMIL
// would start at the document's time zero.
function Ring({ r, color }: { r: number; color: string }) {
  const ring = useRef<SVGCircleElement>(null)
  useEffect(() => {
    ring.current?.animate(RING, { duration: 240, easing: 'ease-out', fill: 'forwards' })
  }, [])
  return (
    <circle
      ref={ring}
      data-slot="fret-ring"
      r={r + 4}
      fill="none"
      stroke={color}
      strokeWidth={2}
      opacity={0}
      style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
    />
  )
}
const SPACES = WIRES.slice(1)

export function FretboardDiagram({
  names,
  window,
  width,
  height,
  readPx,
  numberPx,
  sounding,
  next,
  shift,
  capo = 0,
  mirrored = false,
  instant = false,
  landing,
  accent,
  label,
  className,
}: FretboardDiagramProps) {
  const clip = useId()
  const strings = names.length
  const rows = stringRows(height, strings, readPx)
  const gutter = Math.round(Math.max(numberPx * 1.6, readPx * 0.9))
  const x0 = gutter
  const x1 = width - 2
  const open = Math.min(rows.lane * 1.1, 56)
  const fx0 = x0 + open + 6
  const fx1 = x1 - 8
  const flip = (x: number) => (mirrored ? x0 + x1 - x : x)
  const across = (fraction: number) => flip(fx0 + fraction * (fx1 - fx0))
  const yTop = rowAt(rows, 1)
  const yBottom = rowAt(rows, strings)
  const middle = (yTop + yBottom) / 2
  const glide = {
    transition: instant ? 'none' : 'transform var(--duration-slow) var(--ease-standard)',
  }
  const place = (x: number, y = 0) => ({ ...glide, transform: `translate(${x}px, ${y}px)` })
  const spaceWidth = ((fx1 - fx0) / (window.hi - window.lo + 1)) * 0.8
  const r = Math.max(8, Math.min(rows.lane * 0.42, 22, spaceWidth / 2))
  const dotX = (fret: number) => (fret === 0 ? flip(x0 + open / 2) : across(spaceAt(window, fret)))
  const lit = new Set(sounding.map((p) => `${p.string}:${p.fret}`))
  const thickness = (string: number) => 1 + (string - 1) * (strings <= 5 ? 0.6 : 0.32)
  const regionLeft = Math.min(flip(fx0), flip(fx1)) - 3
  const towardRight = shift ? shift.fret > window.hi !== mirrored : false
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      data-slot="fretboard-diagram"
      data-mirrored={mirrored || undefined}
      data-capo={capo || undefined}
      className={className}
    >
      <defs>
        <clipPath id={clip}>
          <rect x={regionLeft} y={0} width={fx1 - fx0 + 6} height={height} />
        </clipPath>
      </defs>
      {names.map((name, i) => (
        <text
          // biome-ignore lint/suspicious/noArrayIndexKey: strings are positional
          key={i}
          x={gutter / 2}
          y={rowAt(rows, i + 1)}
          fontSize={numberPx}
          fontWeight={600}
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--conf-medium)"
        >
          {name}
        </text>
      ))}
      {names.map((_, i) => (
        <rect
          // biome-ignore lint/suspicious/noArrayIndexKey: strings are positional
          key={i}
          x={x0}
          y={rowAt(rows, i + 1) - thickness(i + 1) / 2}
          width={x1 - x0}
          height={thickness(i + 1)}
          fill="var(--ink)"
          opacity={0.55}
        />
      ))}
      <g clipPath={`url(#${clip})`}>
        {SPACES.map((fret) => {
          const actual = fret + capo
          const dot = Math.max(4, rows.lane * 0.14)
          return (
            <g key={fret} style={place(across(spaceAt(window, fret)))}>
              {INLAYS.has(actual) && (
                <circle cx={0} cy={middle} r={dot} fill="var(--staff)" opacity={0.45} />
              )}
              {actual % 12 === 0 && (
                <>
                  <circle
                    cx={0}
                    cy={middle - rows.lane}
                    r={dot}
                    fill="var(--staff)"
                    opacity={0.45}
                  />
                  <circle
                    cx={0}
                    cy={middle + rows.lane}
                    r={dot}
                    fill="var(--staff)"
                    opacity={0.45}
                  />
                </>
              )}
              <text
                x={0}
                y={yBottom + rows.lane / 2 + numberPx + 4}
                fontSize={numberPx}
                fontWeight={500}
                textAnchor="middle"
                fill="var(--conf-medium)"
              >
                {fret}
              </text>
            </g>
          )
        })}
        {WIRES.map((wire) => (
          <g key={wire} style={place(across(wireAt(window, wire)))}>
            {wire === 0 ? (
              <rect
                x={capo > 0 ? -4 : -2}
                y={yTop - 6}
                width={capo > 0 ? 8 : 4}
                height={yBottom - yTop + 12}
                rx={capo > 0 ? 3 : 0}
                fill="var(--ink)"
              />
            ) : (
              <rect x={-1} y={yTop - 4} width={2} height={yBottom - yTop + 8} fill="var(--staff)" />
            )}
          </g>
        ))}
      </g>
      {/* Up the neck, a break at the nut side says the frets below aren't shown. */}
      <path
        d={`M${flip(fx0 - 7)} ${yTop - 8} l8 8 M${flip(fx0 - 7)} ${yBottom} l8 8`}
        stroke="var(--staff)"
        strokeWidth={2}
        fill="none"
        opacity={window.lo > 1 ? 1 : 0}
        style={{ transition: glide.transition.replace('transform', 'opacity') }}
      />
      {next.map((p) =>
        lit.has(`${p.string}:${p.fret}`) ||
        (p.fret > 0 && (p.fret < window.lo || p.fret > window.hi)) ? null : (
          <g
            key={`next-${p.string}:${p.fret}`}
            data-slot="fret-next"
            style={place(dotX(p.fret), rowAt(rows, p.string))}
          >
            <circle
              r={r}
              fill="var(--paper)"
              stroke="var(--conf-medium)"
              strokeWidth={2}
              strokeDasharray="4 3"
            />
            <text
              fontSize={r * 1.05}
              fontWeight={600}
              textAnchor="middle"
              dominantBaseline="central"
              fill="var(--conf-medium)"
            >
              {p.fret}
            </text>
          </g>
        ),
      )}
      {sounding.map((p) =>
        p.fret > 0 && (p.fret < window.lo || p.fret > window.hi) ? null : (
          <g
            key={`now-${p.string}:${p.fret}`}
            data-slot="fret-now"
            style={place(dotX(p.fret), rowAt(rows, p.string))}
          >
            {landing !== undefined && p.landed && <Ring key={landing} r={r} color={accent} />}
            {p.fret === 0 ? (
              <circle r={r * 0.8} fill="var(--paper)" stroke="var(--ink)" strokeWidth={2.5} />
            ) : (
              <>
                <circle r={r + 3} fill={accent} />
                <circle r={r} fill="var(--ink)" />
              </>
            )}
            <text
              fontSize={p.fret === 0 ? r * 0.9 : r * 1.1}
              fontWeight={650}
              textAnchor="middle"
              dominantBaseline="central"
              fill={p.fret === 0 ? 'var(--ink)' : 'var(--paper)'}
            >
              {p.fret}
            </text>
          </g>
        ),
      )}
      {shift && (
        <g
          data-slot="fret-shift"
          transform={`translate(${towardRight ? x1 - 4 : x0 + 4} ${rows.top - rows.head / 2 - 4})`}
        >
          <rect
            x={towardRight ? -(numberPx * 5.2) : 0}
            y={-numberPx * 0.85}
            width={numberPx * 5.2}
            height={numberPx * 1.7}
            rx={numberPx * 0.85}
            fill="var(--paper)"
            stroke="var(--ink)"
            strokeWidth={1.5}
          />
          <text
            x={towardRight ? -(numberPx * 2.6) : numberPx * 2.6}
            fontSize={numberPx}
            fontWeight={600}
            textAnchor="middle"
            dominantBaseline="central"
            fill="var(--ink)"
          >
            {towardRight ? `${shift.label} →` : `← ${shift.label}`}
          </text>
        </g>
      )}
    </svg>
  )
}
