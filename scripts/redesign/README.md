# Mockup harness (`scripts/redesign/`)

Renders the redesign mockups (`redesign/mockups/*.dc.html`) without the Design-canvas runtime, so
later redesign steps can compare the app against them: reference PNGs for eyeballing, and a probe
that returns measurements (aria structure, computed styles, bounding boxes) for fidelity checks.
Measurements are the check; a pixel diff is a smoke signal only. Nothing here writes to
`redesign/mockups/`.

| File | What it is |
|---|---|
| `shim.js` | Browser-side stand-in for the canvas runtime. Served as the mockups' `./support.js`. |
| `harness.mjs` | Board list, render plan, localhost server, opening a board in Chromium, font report. |
| `render-mockups.mjs` | CLI: reference PNGs + manifest, and the `--check` self-check. |
| `probe.mjs` | CLI and module: aria snapshot, boxes and computed styles for a board or any URL. |
| `harness.test.mjs` | Vitest unit tests for the board list and render plan (no browser; part of `pnpm test`). |

Playwright and Chromium come from `apps/web` (`playwright` 1.64.1 and its installed Chromium); there
is no root dependency and no root `pnpm` script. Run everything from the repo root with Node 24.
The scripts launch Chromium, so on a shared machine hold the redesign run's heavy lock around them
(one heavy browser run per machine).

## Commands

```bash
node scripts/redesign/render-mockups.mjs --check     # self-check, writes nothing
node scripts/redesign/render-mockups.mjs             # all 110 reference PNGs (about 30 s)
node scripts/redesign/render-mockups.mjs --file Main --file Library --width 1440 --look daylight
node scripts/redesign/probe.mjs Main --look daylight --select .play --select 'role=button[name="Pause"]'
node scripts/redesign/probe.mjs 'http://localhost:6006/iframe.html?id=ui-button--primary&globals=theme:dark' \
  --width 1180 --select button --wait-for button --out /tmp/button.json
pnpm exec vitest run --dir scripts/redesign          # unit tests only
```

`render-mockups.mjs` options: `--file <name>` (`Main` or `Main.dc.html`), `--width <px>`,
`--look night|daylight|fixed`, each repeatable or comma-separated; `--out <dir>`; `--check`. It exits
1 if any render fails and names the file and the reason; an unknown `--file` is an error too.

`--check` renders every board once in every look it has (at its canvas width) and fails on any
shim error, page error or failed local request. It also serves four broken fixtures (unknown tag,
unresolved hole, unresolved hole inside an `<sc-for>` item, `?look=` on a board without a look
prop) and fails unless each of them is rejected with the expected message.

## What gets rendered

- **Looks.** 21 boards have a `look` prop; they render as `night` (`Night Rehearsal`: `.app`,
  `data-theme="dark"`) and `daylight` (`Daylight`: `.app`, `data-theme="light"`). The direction
  studies (`Dir-A/B/C`) and Foundations (`System`) have no look prop and render once as `fixed`.
  The other two look options (Annotated Score, Pedalboard) are direction studies and aren't rendered.
- **Widths.** Boards with `"expand": "fill"` in `canvas.json` are fluid and render at 1440, 1180 and
  390. Fixed-size boards render only at their own width: phones at 390, `Stand` at 1180, `System`
  at 1440, `Dir-A/B/C` at 1280. Skips are printed and kept in the manifest.
- **Viewport.** Width as above, height = the board's `canvas.json` height (`100vh` layouts depend
  on it), device scale 1, `prefers-color-scheme` matching the look, reduced motion; screenshots are
  full-page with animations disabled.
- **Desktop-only boards at 390.** The practice boards are fixed desktop layouts
  (`height: 100vh; overflow: hidden`), so their 390 renders show what the mockup CSS does on a
  phone, not a designed phone layout: the phone designs are the `Phone-*` boards. The manifest's
  `overflowX` (px of content cut off or scrolled sideways) flags these.
- **Fixed boards wider than their frame.** `System` (1440 × 1200) and `Dir-C` (1280 × 800) put
  padding on a content-box root, so they lay out at 1520 × 1280 and 1324 × 840. The full-page PNG
  shows all of it; the canvas frame would cut the right and bottom edge.

Full run: 16 fluid boards × 2 looks × 3 widths + 4 phones × 2 + `Stand` × 2 + 4 fixed-look boards
= 96 + 8 + 2 + 4 = **110 PNGs**.

## Output

`redesign/.renders/` (git-ignored):

```
redesign/.renders/
  manifest.json
  Main/night-1440.png  Main/daylight-1440.png  Main/night-1180.png  …
  Phone-Practice/night-390.png  Phone-Practice/daylight-390.png
  Dir-A/fixed-1280.png
```

`manifest.json` (`schema: 1`): `skips` (strings) and `renders`, one per PNG, sorted by board, look,
width. A filtered run replaces only its own entries.

```json
{
  "board": "Main", "file": "Main.dc.html", "title": "Practice · Tab, loop + speed ladder",
  "look": "night", "lookName": "Night Rehearsal", "width": 1440, "viewportHeight": 900,
  "png": "Main/night-1440.png",
  "page": { "width": 1440, "height": 900 },
  "theme": "dark", "rootClass": "app", "overflowX": 0,
  "fonts": { "requested": ["Instrument Sans", "JetBrains Mono"], "loaded": ["…"], "missing": [] },
  "ms": 812
}
```

## Fonts (network)

The mockups load Instrument Sans, Instrument Serif, JetBrains Mono and Space Grotesk from Google
Fonts (`fonts.googleapis.com` in each board's `<helmet>`), so faithful renders need network access.
Offline (not tested), the font request is the only one that fails, the CSS fallbacks (system UI
and monospace fonts) are drawn, and `missing` says so.
Every manifest entry and probe result records `fonts`: `requested` (the first family of every
element that shows text), `loaded` (families with a loaded face) and `missing` (requested but not
loaded, i.e. drawn with a fallback); the render log prints `fallback for …` when `missing` is not
empty. Check `missing` before trusting a font comparison.

## Probe

`probe(target, options)` (module) and `probe.mjs <target>` (CLI) open a board (`Main` or
`Main.dc.html`, rendered through the shim; errors throw) or an `http(s)` URL, and return JSON.
Options: `look` (default `night`, or `fixed` for boards without a look prop; for URLs it only sets
`prefers-color-scheme`, so put the app's theme in the URL), `width`/`height` (default: the board's
canvas size, 1440×900 for URLs), `selectors` (Playwright selectors: CSS by default,
`role=button[name="Pause"]` matches the exact name, `role=button[name=/Felt clean/]` a substring,
`text=…`), `limit` (elements measured per selector, default 20), `aria` (default true), `waitFor`
(URL targets), `browser` (reuse one Chromium across calls). Inside a Playwright test,
`probePage(page, { selectors, limit, aria })` measures a page you already have.

Schema 1 (keys always present, in this order):

```jsonc
{
  "schema": 1,
  "target": "Main.dc.html",                          // board file, or the URL
  "url": "redesign/mockups/Main.dc.html?look=Daylight", // stable: no server port
  "look": "daylight",
  "viewport": { "width": 1440, "height": 900 },
  "page": { "width": 1440, "height": 900 },          // document scroll size
  "dataTheme": "light",                              // first [data-theme] in the document, or null
  "fonts": { "requested": [], "loaded": [], "missing": [] },
  "aria": {                                          // null with --no-aria
    "roles": { "banner": 1, "button": 48, "…": 0 },  // count of each role line in the snapshot
    "snapshot": "- banner:\n  - link \"Library\":\n …" // Playwright ariaSnapshot() YAML of <body>
  },
  "elements": {
    ".play": {
      "count": 1,                                    // all matches, even beyond `limit`
      "items": [{
        "index": 0, "tag": "button",
        "text": "",                                  // innerText, whitespace collapsed, ≤ 80 chars
        "attrs": { "id": null, "class": "play", "role": null, "ariaLabel": "Pause" },
        "box": { "x": 80, "y": 820.5, "width": 64, "height": 64 }, // CSS px, page coordinates, 2 dp
        "styles": {                                  // getComputedStyle values, as Chromium gives them
          "display": "flex", "color": "oklch(0.21 0.012 60)", "backgroundColor": "oklch(0.8 0.15 72)",
          "fontFamily": "\"Instrument Sans\", ui-sans-serif, …", "fontSize": "15px",
          "fontWeight": "400", "lineHeight": "21.75px", "letterSpacing": "normal",
          "padding": ["1px", "6px", "1px", "6px"],          // top, right, bottom, left
          "borderWidth": ["0px", "0px", "0px", "0px"],      // top, right, bottom, left
          "borderStyle": ["none", "none", "none", "none"],
          "borderColor": ["…", "…", "…", "…"],
          "borderRadius": ["50%", "50%", "50%", "50%"],     // top-left, top-right, bottom-right, bottom-left
          "gap": ["normal", "normal"],                      // row, column
          "opacity": "1"
        },
        "srgb": {                                    // the same colours as #rrggbbaa via a canvas
          "color": "#1d1713ff", "backgroundColor": "#f8ac3dff", "borderColor": ["…", "…", "…", "…"]
        }
      }]
    }
  }
}
```

Compare `styles` for exact token use and `srgb` when the two sides spell colours differently
(oklch vs hex). `srgb` is clipped to sRGB and 8-bit, and semi-transparent colours lose precision,
so allow ±1 per channel.

## Shim: what it supports, and its limits

The shim implements the subset of the canvas runtime the 25 mockups use, and fails loudly on
anything else (the board file, the reason and an element path are reported):

- `<x-dc>`: exactly one per file, replaced by its expanded content. `<helmet>`: direct child of
  `<x-dc>`; its children move into `<head>`.
- `<script type="text/x-dc" data-props='…'>`: exactly one; it must define `class Component extends
  DCLogic`. `DCLogic` sets `this.props`, `this.state = {}` and has `setState(patch)`.
  `renderVals()` is called once. Props: only `enum` props with a `default` (today only `look`);
  `$`-prefixed keys such as `$preview` are ignored. `?look=<option>` overrides `look`; an unknown
  look, a `?look=` on a board without the prop, or any other query parameter is an error.
- `<sc-for list="{{…}}" as="name">` repeats its children per item with `name` in scope;
  `<sc-if value="{{…}}">` keeps its children when the value is truthy. Both unwrap (the mockup CSS
  relies on `.wave > i`, `.beats > i`), and only `hint-placeholder-count` / `hint-placeholder-val`
  are allowed besides; `list` must be an array.
- `{{holes}}` in text and attributes: `true`, `false`, `null`, a number, or a dotted path looked up
  from the innermost `sc-for` item outward to `renderVals()`. A missing name or property, an
  `undefined` value, an object, or a boolean in text is an error. Booleans in attributes become
  `"true"`/`"false"` (`aria-pressed`, `aria-checked`).
- `on*="{{fn}}"` handlers (Main's play button) must resolve to a function and are removed: renders
  are static, so state stays at the constructor's initial value (Main renders "playing").
- After expansion every element must be a known HTML or SVG element and no `{{` may remain.

Limits: no re-render, events or state changes; no props other than `look`; no expression holes
(`{{a + b}}`, calls, indexing); the template is parsed by the browser first, so markup the HTML
parser restructures (for example a `<div>` inside a `<p>`) is restructured the same way it would be
on the canvas. The mockups' own pre-render template briefly shows unfilled holes, so Chromium logs
SVG attribute warnings (`<path> attribute d: Expected number`) to the console; those are not errors.
