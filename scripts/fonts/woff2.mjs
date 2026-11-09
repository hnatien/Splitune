// Just enough of a WOFF2 reader for the font checks (fonts.test.mjs): the table directory, the
// Brotli stream, and from it the cmap, the GSUB feature tags, post's fixed-pitch flag and the
// advance widths. Transformed tables other than glyf/loca (an hmtx transform) are refused.
import { readFileSync } from 'node:fs'
import { brotliDecompressSync } from 'node:zlib'

// WOFF2 known-table tags, by the index in a directory entry's flags (WOFF2 §5.1).
const KNOWN_TAGS = (
  'cmap,head,hhea,hmtx,maxp,name,OS/2,post,cvt ,fpgm,glyf,loca,prep,CFF ,VORG,EBDT,EBLC,gasp,' +
  'hdmx,kern,LTSH,PCLT,VDMX,vhea,vmtx,BASE,GDEF,GPOS,GSUB,EBSC,JSTF,MATH,CBDT,CBLC,COLR,CPAL,' +
  'SVG ,sbix,acnt,avar,bdat,bloc,bsln,cvar,fdsc,feat,fmtx,fvar,gvar,hsty,just,lcar,mort,morx,' +
  'opbd,prop,trak,Zapf,Silf,Glat,Gloc,Feat,Sill'
).split(',')

function base128(view, at) {
  let value = 0
  for (let i = 0; i < 5; i++) {
    const byte = view.getUint8(at + i)
    value = value * 128 + (byte & 0x7f)
    if ((byte & 0x80) === 0) return [value, at + i + 1]
  }
  throw new Error('UIntBase128 longer than 5 bytes')
}

/** The decompressed tables of a WOFF2 file, by tag, each as a DataView. */
export function readTables(path) {
  const file = readFileSync(path)
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength)
  if (view.getUint32(0) !== 0x774f4632) throw new Error(`${path} is not WOFF2`)
  const numTables = view.getUint16(12)
  const compressedSize = view.getUint32(20)
  let at = 48
  const entries = []
  for (let i = 0; i < numTables; i++) {
    const flags = view.getUint8(at++)
    let tag = KNOWN_TAGS[flags & 0x3f]
    if ((flags & 0x3f) === 63) {
      tag = String.fromCharCode(...file.subarray(at, at + 4))
      at += 4
    }
    const version = flags >> 6
    let length
    ;[length, at] = base128(view, at)
    // glyf and loca are transformed at version 0; every other table at a non-zero version.
    const transformed = tag === 'glyf' || tag === 'loca' ? version === 0 : version !== 0
    if (transformed) [length, at] = base128(view, at)
    entries.push({ tag, length, transformed })
  }
  const data = brotliDecompressSync(file.subarray(at, at + compressedSize))
  const tables = new Map()
  let offset = 0
  for (const { tag, length, transformed } of entries) {
    if (!transformed) tables.set(tag, new DataView(data.buffer, data.byteOffset + offset, length))
    else if (tag !== 'glyf' && tag !== 'loca') throw new Error(`${path}: transformed ${tag}`)
    offset += length
  }
  return tables
}

const table = (tables, tag) => {
  const found = tables.get(tag)
  if (!found) throw new Error(`no ${tag} table`)
  return found
}

/** Code point → glyph id, from the best Unicode subtable (format 12, else format 4). */
export function readCmap(tables) {
  const cmap = table(tables, 'cmap')
  const records = []
  for (let i = 0; i < cmap.getUint16(2); i++) {
    const at = 4 + i * 8
    const platform = cmap.getUint16(at)
    const encoding = cmap.getUint16(at + 2)
    const offset = cmap.getUint32(at + 4)
    if (platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10))) {
      records.push({ format: cmap.getUint16(offset), offset })
    }
  }
  const map = new Map()
  const best = records.find((r) => r.format === 12) ?? records.find((r) => r.format === 4)
  if (!best) throw new Error('no Unicode cmap subtable')
  const { offset } = best
  if (best.format === 12) {
    for (let g = 0; g < cmap.getUint32(offset + 12); g++) {
      const at = offset + 16 + g * 12
      const start = cmap.getUint32(at)
      const end = cmap.getUint32(at + 4)
      const glyph = cmap.getUint32(at + 8)
      for (let cp = start; cp <= end; cp++) map.set(cp, glyph + cp - start)
    }
    return map
  }
  const segments = cmap.getUint16(offset + 6) / 2
  const ends = offset + 14
  const starts = ends + segments * 2 + 2
  const deltas = starts + segments * 2
  const rangeOffsets = deltas + segments * 2
  for (let s = 0; s < segments; s++) {
    const end = cmap.getUint16(ends + s * 2)
    const start = cmap.getUint16(starts + s * 2)
    const delta = cmap.getInt16(deltas + s * 2)
    const rangeOffset = cmap.getUint16(rangeOffsets + s * 2)
    for (let cp = start; cp <= end && cp !== 0xffff; cp++) {
      let glyph
      if (rangeOffset === 0) glyph = (cp + delta) & 0xffff
      else {
        const raw = cmap.getUint16(rangeOffsets + s * 2 + rangeOffset + (cp - start) * 2)
        glyph = raw === 0 ? 0 : (raw + delta) & 0xffff
      }
      if (glyph !== 0) map.set(cp, glyph)
    }
  }
  return map
}

/** The OpenType feature tags in GSUB's feature list. */
export function readGsubFeatures(tables) {
  const gsub = tables.get('GSUB')
  if (!gsub) return new Set()
  const list = gsub.getUint16(6)
  const tags = new Set()
  for (let i = 0; i < gsub.getUint16(list); i++) {
    const at = list + 2 + i * 6
    tags.add(String.fromCharCode(...[0, 1, 2, 3].map((k) => gsub.getUint8(at + k))))
  }
  return tags
}

/** post.isFixedPitch: every glyph has the same advance. */
export function isFixedPitch(tables) {
  return table(tables, 'post').getUint32(12) !== 0
}

/** Advance width of a glyph id, in font units. */
export function advanceOf(tables, glyph) {
  const metrics = table(tables, 'hhea').getUint16(34)
  const hmtx = table(tables, 'hmtx')
  return hmtx.getUint16(Math.min(glyph, metrics - 1) * 4)
}

/** The variation axes (fvar) as { tag: [min, default, max] }; empty for a static font. */
export function readAxes(tables) {
  const fvar = tables.get('fvar')
  if (!fvar) return {}
  const first = fvar.getUint16(4)
  const size = fvar.getUint16(10)
  const fixed = (at) => fvar.getInt32(at) / 65536
  const axes = {}
  for (let i = 0; i < fvar.getUint16(8); i++) {
    const at = first + i * size
    const tag = String.fromCharCode(...[0, 1, 2, 3].map((k) => fvar.getUint8(at + k)))
    axes[tag] = [fixed(at + 4), fixed(at + 8), fixed(at + 12)]
  }
  return axes
}
