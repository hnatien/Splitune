// The Splitune mark for the terminal: the curves of apps/web/public/icons/icon.svg rasterised into
// braille cells (2×4 dots each), so the dev dashboard draws the real logo rather than a lookalike.

// Cubic Béziers in the icon's 32-unit viewBox: the waveform, then the fork. `accent` is the indigo
// branch; the rest are ink.
const CURVES = [
  {
    accent: false,
    points: [
      [3, 16],
      [5.5, 10.5],
      [7.5, 10.5],
      [9.5, 16],
    ],
  },
  {
    accent: false,
    points: [
      [9.5, 16],
      [11.5, 21.5],
      [13.5, 21.5],
      [16, 16],
    ],
  },
  {
    accent: true,
    points: [
      [16, 16],
      [19, 12.25],
      [22, 10],
      [29, 10],
    ],
  },
  {
    accent: false,
    points: [
      [16, 16],
      [19, 19.75],
      [22, 22],
      [29, 22],
    ],
  },
]

const DOTS_PER_UNIT = 2
const STROKE = 1.4
const SAMPLES = 400
// Braille dot bits by [row][column] within a cell (U+2800 block).
const DOT_BITS = [
  [0x01, 0x08],
  [0x02, 0x10],
  [0x04, 0x20],
  [0x40, 0x80],
]

function bezier([p0, p1, p2, p3], t) {
  const u = 1 - t
  return [0, 1].map(
    (i) => u * u * u * p0[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p2[i] + t * t * t * p3[i],
  )
}

// Returns rows of cells, each { char, accent }: the cell is accent when most of its dots belong to
// the indigo branch.
export function renderMark() {
  const pad = STROKE / 2
  const [minX, minY, maxX, maxY] = [3 - pad, 10 - pad, 29 + pad, 22 + pad]
  const width = Math.ceil(((maxX - minX) * DOTS_PER_UNIT) / 2) * 2
  const height = Math.ceil(((maxY - minY) * DOTS_PER_UNIT) / 4) * 4
  // 0 = empty, 1 = ink, 2 = accent
  const dots = Array.from({ length: height }, () => new Uint8Array(width))
  const radius = (STROKE * DOTS_PER_UNIT) / 2
  const reach = Math.ceil(radius)

  for (const curve of CURVES) {
    for (let s = 0; s <= SAMPLES; s++) {
      const [x, y] = bezier(curve.points, s / SAMPLES)
      const cx = (x - minX) * DOTS_PER_UNIT
      const cy = (y - minY) * DOTS_PER_UNIT
      for (let dy = -reach; dy <= reach; dy++) {
        for (let dx = -reach; dx <= reach; dx++) {
          const px = Math.floor(cx) + dx
          const py = Math.floor(cy) + dy
          if (px < 0 || py < 0 || px >= width || py >= height) continue
          if (Math.hypot(px + 0.5 - cx, py + 0.5 - cy) > radius) continue
          if (dots[py][px] !== 2) dots[py][px] = curve.accent ? 2 : 1
        }
      }
    }
  }

  const rows = []
  for (let row = 0; row < height / 4; row++) {
    const cells = []
    for (let col = 0; col < width / 2; col++) {
      let bits = 0
      let accent = 0
      let ink = 0
      for (let dy = 0; dy < 4; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const dot = dots[row * 4 + dy][col * 2 + dx]
          if (dot === 0) continue
          bits |= DOT_BITS[dy][dx]
          if (dot === 2) accent++
          else ink++
        }
      }
      cells.push({ char: String.fromCodePoint(0x2800 + bits), accent: accent > ink })
    }
    rows.push(cells)
  }
  return rows
}

// "SPLITUNE" in three rows of box-drawing characters.
export const WORDMARK = [
  '┌─┐┌─┐┬  ┬┌┬┐┬ ┬┌┐┌┌─┐',
  '└─┐├─┘│  │ │ │ ││││├┤ ',
  '└─┘┴  ┴─┘┴ ┴ └─┘┘└┘└─┘',
]

export const TAGLINE = 'Learn the songs you love, one loop at a time.'
