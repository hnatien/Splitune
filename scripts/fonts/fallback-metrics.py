"""Metric overrides for a local fallback face that stands in for a web font while it loads.

The fallback is scaled so text of average English letters and spaces sets to the web font's width
(size-adjust), and its line box takes the web font's ascent, descent and line gap, so swapping the
real font in can't reflow anything (docs/specs/26-design-system.md §6.1, 28 §3.1). The values in
packages/ui-tokens/src/fonts.css come from this script:

    uvx --from "fonttools[woff]==4.67.0" python -I scripts/fonts/fallback-metrics.py \
        apps/web/public/fonts/InstrumentSans.woff2 /path/to/Arial.ttf
"""

import sys

from fontTools.ttLib import TTFont

# English letter frequencies with the space, the weighting capsize and next/font use for xWidthAvg.
FREQUENCIES = {
    " ": 0.1818, "e": 0.1025, "t": 0.0745, "a": 0.0668, "o": 0.0629, "n": 0.0576, "i": 0.0574,
    "s": 0.0538, "r": 0.0503, "h": 0.0503, "l": 0.0332, "d": 0.0332, "c": 0.0227, "u": 0.0222,
    "m": 0.0201, "f": 0.0186, "w": 0.0158, "g": 0.0158, "y": 0.0158, "p": 0.0152, "b": 0.0124,
    "v": 0.0081, "k": 0.0058, "x": 0.0013, "j": 0.0010, "q": 0.0008, "z": 0.0006,
}


def average_width(font: TTFont) -> float:
    """Frequency-weighted advance of the letters and the space, in em."""
    cmap, hmtx = font.getBestCmap(), font["hmtx"]
    total = sum(FREQUENCIES.values())
    width = sum(hmtx[cmap[ord(char)]][0] * weight for char, weight in FREQUENCIES.items())
    return width / total / font["head"].unitsPerEm


def line_metrics(font: TTFont) -> tuple[float, float, float]:
    """Ascent, descent and line gap in em, as browsers pick them (typo metrics when flagged)."""
    upm, os2 = font["head"].unitsPerEm, font["OS/2"]
    if os2.fsSelection & (1 << 7):
        return os2.sTypoAscender / upm, -os2.sTypoDescender / upm, os2.sTypoLineGap / upm
    hhea = font["hhea"]
    return hhea.ascent / upm, -hhea.descent / upm, hhea.lineGap / upm


def percent(value: float) -> str:
    return f"{value * 100:.2f}%"


def main(web_font: str, fallback: str) -> None:
    web, local = TTFont(web_font), TTFont(fallback)
    size_adjust = average_width(web) / average_width(local)
    ascent, descent, line_gap = line_metrics(web)
    print(f"/* {web['name'].getDebugName(4)} over {local['name'].getDebugName(4)} "
          f"{local['name'].getDebugName(5)} */")
    print(f"size-adjust: {percent(size_adjust)};")
    print(f"ascent-override: {percent(ascent / size_adjust)};")
    print(f"descent-override: {percent(descent / size_adjust)};")
    print(f"line-gap-override: {percent(line_gap / size_adjust)};")


if __name__ == "__main__":
    main(*sys.argv[1:3])
