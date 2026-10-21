#!/usr/bin/env bash
# Reproducible WOFF2 subsets of the self-hosted fonts (docs/implementation/26-design-system.md §6.1).
# Downloads pinned upstream files, checks their SHA-256, subsets them with pyftsubset keeping every
# OpenType layout feature (Fontsource subsets strip tnum/cv*/ss*) and the variation axes, and writes
# WOFF2 plus the OFL licences to apps/web/public/fonts/. Run from anywhere: scripts/fonts/subset.sh
#
# Inter's wght axis is limited to 400–700, the weights the type scale uses (§6.2); that keeps the
# preloaded roman file under the 80 KB budget with opsz and all features intact.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="$ROOT/apps/web/public/fonts"
FONTTOOLS="fonttools[woff]==4.67.0"
# fontTools stamps head.modified from this, so repeated runs produce identical files.
export SOURCE_DATE_EPOCH=1731628800

INTER_URL="https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip"
INTER_SHA256="9883fdd4a49d4fb66bd8177ba6625ef9a64aa45899767dde3d36aa425756b11e"
AHN_COMMIT="95f4904fc8bcf26d3420fe315560c96417c6dec7"
AHN_BASE="https://raw.githubusercontent.com/google/fonts/$AHN_COMMIT/ofl/atkinsonhyperlegiblenext"
AHN_SHA256="5a455d1cfa099b601ab70751bb9673e8fe1854dc4500c80e1a220d0d75e31745"

# Basic Latin, Latin-1, common Latin extras, general punctuation (dashes, nbsp, ellipsis), euro,
# minus sign (−3 dB), arrows and the keyboard symbols used in shortcuts.
UNICODES="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,\
U+2000-206F,U+20AC,U+2122,U+2190-2193,U+21B5,U+21E7,U+2212,U+2215,U+2318,U+2325,U+FEFF,U+FFFD"

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

limit_weights() { # source.ttf output.ttf
  uvx --from "$FONTTOOLS" fonttools varLib.instancer "$1" wght=400:700 --output "$2"
}

subset() { # source.ttf output.woff2
  uvx --from "$FONTTOOLS" pyftsubset "$1" \
    --unicodes="$UNICODES" \
    --layout-features='*' \
    --flavor=woff2 \
    --output-file="$2"
}

curl -fsSL "$INTER_URL" -o "$WORK/inter.zip"
check "$WORK/inter.zip" "$INTER_SHA256"
unzip -q -o "$WORK/inter.zip" InterVariable.ttf InterVariable-Italic.ttf LICENSE.txt -d "$WORK/inter"

curl -fsSL "$AHN_BASE/AtkinsonHyperlegibleNext%5Bwght%5D.ttf" -o "$WORK/ahn.ttf"
check "$WORK/ahn.ttf" "$AHN_SHA256"
curl -fsSL "$AHN_BASE/OFL.txt" -o "$WORK/ahn-OFL.txt"

mkdir -p "$OUT"
limit_weights "$WORK/inter/InterVariable.ttf" "$WORK/inter-roman.ttf"
limit_weights "$WORK/inter/InterVariable-Italic.ttf" "$WORK/inter-italic.ttf"
subset "$WORK/inter-roman.ttf" "$OUT/InterVariable.woff2"
subset "$WORK/inter-italic.ttf" "$OUT/InterVariable-Italic.woff2"
subset "$WORK/ahn.ttf" "$OUT/AtkinsonHyperlegibleNext.woff2"
cp "$WORK/inter/LICENSE.txt" "$OUT/Inter-OFL.txt"
cp "$WORK/ahn-OFL.txt" "$OUT/AtkinsonHyperlegibleNext-OFL.txt"

for file in "$OUT"/*.woff2; do
  printf '%-36s %6d bytes\n' "$(basename "$file")" "$(wc -c <"$file")"
done
