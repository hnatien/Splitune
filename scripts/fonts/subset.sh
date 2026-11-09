#!/usr/bin/env bash
# Reproducible WOFF2 subsets of the self-hosted fonts (docs/specs/26-design-system.md §6.1).
# Downloads pinned upstream files, checks their SHA-256, limits the variation axes to the weights the
# type scale uses (varLib.instancer), subsets them with pyftsubset keeping every OpenType layout
# feature (Fontsource subsets strip tnum/cv*/ss*), and writes WOFF2 plus the OFL licences to
# apps/web/public/fonts/. Run from anywhere: scripts/fonts/subset.sh
#
# - Instrument Sans: words and chord names. Roman only, wght 400–700 at wdth 100; preloaded, so it
#   stays under the 80 KB preload budget (fonts.test.mjs checks it).
# - JetBrains Mono: every number that changes and the tab digits. wght 400–700. Monospaced, so its
#   digits are tabular without a tnum feature (it has none).
# - Atkinson Hyperlegible Next: the opt-in reading font, its whole wght axis.
# Neither Instrument Sans nor JetBrains Mono maps U+202F (narrow no-break space, Intl's space before
# "%" and between digit groups in some locales); nnbsp() maps it to the font's own no-break space
# glyph before subsetting, so it never falls back to another font.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="$ROOT/apps/web/public/fonts"
FONTTOOLS="fonttools[woff]==4.67.0"
# fontTools stamps head.modified from this, so repeated runs produce identical files.
export SOURCE_DATE_EPOCH=1731628800

GF_COMMIT="95f4904fc8bcf26d3420fe315560c96417c6dec7"
GF_BASE="https://raw.githubusercontent.com/google/fonts/$GF_COMMIT/ofl"
# Instrument Sans 1.000 (upstream github.com/Instrument/instrument-sans 7fa2230; no later release).
IS_SHA256="b24f1812584816958afcf22e22d08e44318c5e51651e25d2438efdde389b33b1"
JBM_URL="https://github.com/JetBrains/JetBrainsMono/releases/download/v2.304/JetBrainsMono-2.304.zip"
JBM_SHA256="6f6376c6ed2960ea8a963cd7387ec9d76e3f629125bc33d1fdcd7eb7012f7bbf"
AHN_SHA256="5a455d1cfa099b601ab70751bb9673e8fe1854dc4500c80e1a220d0d75e31745"

# Basic Latin, Latin-1, common Latin extras, general punctuation (dashes, nbsp, narrow nbsp, ‹ ›,
# ellipsis), euro, minus sign (−3 dB), arrows, the keyboard symbols used in shortcuts, and the music
# signs ♭ ♮ ♯ (where a family has them; ChordSymbol draws missing ones from the fallback).
UNICODES="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,\
U+2000-206F,U+20AC,U+2122,U+2190-2193,U+21B5,U+21E7,U+2212,U+2215,U+2318,U+2325,U+266D-266F,\
U+FEFF,U+FFFD"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

check() { # file expected-sha256
  local actual
  actual="$(shasum -a 256 "$1" | cut -d' ' -f1)"
  if [[ "$actual" != "$2" ]]; then
    echo "SHA-256 mismatch for $1: $actual (expected $2)" >&2
    exit 1
  fi
}

instance() { # source.ttf output.ttf axis-limits…
  local source="$1" output="$2"
  shift 2
  uvx --from "$FONTTOOLS" fonttools varLib.instancer "$source" "$@" --output "$output"
}

nnbsp() { # font.ttf (in place)
  uvx --from "$FONTTOOLS" python -I -c '
import sys
from fontTools.ttLib import TTFont
font = TTFont(sys.argv[1])
for table in font["cmap"].tables:
    if table.isUnicode() and table.format != 14 and 0x00A0 in table.cmap:
        table.cmap.setdefault(0x202F, table.cmap[0x00A0])
font.save(sys.argv[1])
' "$1"
}

subset() { # source.ttf output.woff2
  uvx --from "$FONTTOOLS" pyftsubset "$1" \
    --unicodes="$UNICODES" \
    --layout-features='*' \
    --flavor=woff2 \
    --output-file="$2"
}

curl -fsSL "$GF_BASE/instrumentsans/InstrumentSans%5Bwdth%2Cwght%5D.ttf" -o "$WORK/is.ttf"
check "$WORK/is.ttf" "$IS_SHA256"
curl -fsSL "$GF_BASE/instrumentsans/OFL.txt" -o "$WORK/is-OFL.txt"

curl -fsSL "$JBM_URL" -o "$WORK/jbm.zip"
check "$WORK/jbm.zip" "$JBM_SHA256"
unzip -q -o "$WORK/jbm.zip" "fonts/variable/JetBrainsMono[[]wght].ttf" OFL.txt -d "$WORK/jbm"
mv "$WORK/jbm/fonts/variable/JetBrainsMono[wght].ttf" "$WORK/jbm.ttf"

curl -fsSL "$GF_BASE/atkinsonhyperlegiblenext/AtkinsonHyperlegibleNext%5Bwght%5D.ttf" -o "$WORK/ahn.ttf"
check "$WORK/ahn.ttf" "$AHN_SHA256"
curl -fsSL "$GF_BASE/atkinsonhyperlegiblenext/OFL.txt" -o "$WORK/ahn-OFL.txt"

mkdir -p "$OUT"
instance "$WORK/is.ttf" "$WORK/is-roman.ttf" wght=400:700 wdth=100
instance "$WORK/jbm.ttf" "$WORK/jbm-roman.ttf" wght=400:700
nnbsp "$WORK/is-roman.ttf"
nnbsp "$WORK/jbm-roman.ttf"
subset "$WORK/is-roman.ttf" "$OUT/InstrumentSans.woff2"
subset "$WORK/jbm-roman.ttf" "$OUT/JetBrainsMono.woff2"
subset "$WORK/ahn.ttf" "$OUT/AtkinsonHyperlegibleNext.woff2"
cp "$WORK/is-OFL.txt" "$OUT/InstrumentSans-OFL.txt"
cp "$WORK/jbm/OFL.txt" "$OUT/JetBrainsMono-OFL.txt"
cp "$WORK/ahn-OFL.txt" "$OUT/AtkinsonHyperlegibleNext-OFL.txt"

for file in "$OUT"/*.woff2; do
  printf '%-36s %6d bytes\n' "$(basename "$file")" "$(wc -c <"$file")"
done
