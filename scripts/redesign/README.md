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
| `fixtures.mjs` | Self-check fixtures: exact expected DOM for the shim, and broken boards it must reject. |
| `probe.mjs` | CLI and module: aria snapshot, boxes and computed styles for a board or any URL. |
| `*.test.mjs` | Vitest unit tests for the plan, URL theming and emulation (no browser; part of `pnpm test`). |

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
node scripts/redesign/probe.mjs 'http://localhost:6006/iframe.html?id=base-button--primary&viewMode=story' \
  --look night --width 1180 --select '#storybook-root button' --out /tmp/button-night.json
node scripts/redesign/probe.mjs http://localhost:3000/library --look daylight --width 390 --height 844 \
  --touch --wait-for main --select main
pnpm exec vitest run --dir scripts/redesign          # unit tests only
```

`render-mockups.mjs` options: `--file <name>` (`Main` or `Main.dc.html`), `--width <px>`,
`--look night|daylight|fixed`, each repeatable or comma-separated; `--out <dir>`; `--check`. It exits
1 if any render fails and names the file and the reason; an unknown `--file` is an error too. A
board that fails (including a navigation timeout) fails only itself: the other boards still
render, then the run exits 1. A render whose root `data-theme` doesn't match its look (night =
`dark`, daylight = `light`) is a failure, not a PNG.

`--check` writes nothing. It renders every board once in every look it has (at its canvas width)
and fails on any shim error, page error, failed local request or wrong `data-theme` for the look.
Then `fixtures.mjs` pins the shim's semantics with exact expected DOM: `sc-if` keeps truthy
(`true`, a number) and drops falsy (`false`, a literal `{{false}}`, `0`) branches and unwraps;
`helmet` content lands in `<head>` and no canvas element survives; `sc-for` repeats, an inner `as`
shadows the outer name and the outer one is back after the inner loop, an empty list renders
nothing; attribute holes turn booleans into `"true"`/`"false"`, fill numbers and nested paths
(`{{meta.a.b}}`), drop `onClick` handlers and work on SVG; the `look` prop uses its default without
`?look=` and the requested option with it. Four broken fixtures (unknown tag, unresolved hole,
unresolved hole inside an `<sc-for>` item, `?look=` on a board without a look prop) must each be
rejected with the expected message.

## What gets rendered

- **Looks.** 21 boards have a `look` prop; they render as `night` (`Night Rehearsal`: `.app`,
  `data-theme="dark"`) and `daylight` (`Daylight`: `.app`, `data-theme="light"`). The direction
  studies (`Dir-A/B/C`) and Foundations (`System`) have no look prop and render once as `fixed`.
  The other two look options (Annotated Score, Pedalboard) are direction studies and aren't rendered.
- **Widths.** Boards with `"expand": "fill"` in `canvas.json` are fluid and render at 1440, 1180 and
  390. Fixed-size boards render only at their own width: phones at 390, `Stand` at 1180, `System`
  at 1440, `Dir-A/B/C` at 1280. Skips are printed and kept in the manifest.
- **Viewport.** Width as above, height = the board's `canvas.json` height (`100vh` layouts depend
  on it), device scale 1, `prefers-color-scheme` matching the look, reduced motion, no touch
  emulation; screenshots are full-page with animations disabled.
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
width. A run without filters writes a fresh manifest; a filtered run replaces only its own entries
and adds its skips. Entries of failed jobs are dropped, and a PNG that no entry points at any more
(a failed, removed or renamed board) is deleted, so nothing stale passes as a reference. Only PNGs
listed in the previous manifest are ever deleted.

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
rendered element that shows text; hidden elements such as Storybook's error panel don't count),
`loaded` (families with a loaded face) and `missing` (requested but not loaded, i.e. drawn with a
fallback); the render log prints `fallback for …` when `missing` is not empty. Check `missing`
before trusting a font comparison.

## Probe

`probe(target, options)` (module) and `probe.mjs <target>` (CLI) open a board (`Main` or
`Main.dc.html`, rendered through the shim) or an `http(s)` URL (the app, a Storybook iframe), and
return JSON. Options (CLI flag in brackets):

- `look` (`--look`): `night` (default), `daylight`, or `fixed` (default for boards without a look
  prop; boards only). It reaches each target the way that target themes itself:
  - boards: the `look` prop (`?look=Night Rehearsal`), checked against the root `data-theme`;
  - Storybook (`…/iframe.html`): the `appearance` global is added to the URL
    (`globals=appearance:dark`, see `apps/web/.storybook/preview.tsx`); a URL that already pins a
    different `appearance` is an error;
  - the app: the stored display choice (`localStorage['splitune.display'].appearance`, see
    `apps/web/app/ui/display.ts`) is set before the page loads, so the app's head script applies it;
  - every target: `prefers-color-scheme` is emulated to match.

  Then the probe reads what the page actually shows: `display.dataTheme` for boards and
  `display.appearance` (`<html data-appearance>`) for URLs. If that isn't the look's theme (night =
  `dark`, daylight = `light`), the probe fails, so a Daylight-vs-Night comparison can't slip
  through.
- `motion` (`--motion reduce|full`, default `reduce` for stable measurements): emulates
  `prefers-reduced-motion` and sets the Storybook `motion` global, which Storybook otherwise pins
  to `full`. In the app, `data-motion` follows the emulation unless the stored choice pins it.
- `touch` (`--touch`): emulate a touch phone (`hasTouch` + `isMobile`, so `(pointer: coarse)`
  matches; verified). The app then derives its phone reading distance itself (display.ts: coarse
  pointer + width ≤ 640 → `data-distance="floor"`; not yet run against the app). Storybook pins
  `distance: desk` in its globals, so for a story add `globals=distance:floor` to the URL.
  `display.distance` shows what was in effect.
- `width`/`height` (`--width`/`--height`): default the board's canvas size, 1440×900 for URLs.
- `selectors` (`--select`, repeatable): Playwright selectors. CSS by default;
  `role=button[name="Pause"]` matches the exact name, `role=button[name=/Felt clean/]` a substring;
  `text=…`. In Storybook, scope selectors to `#storybook-root`: the iframe also holds Storybook's
  hidden error-panel buttons.
- `limit` (`--limit`): elements measured per selector, default 20. `aria` (`--no-aria`): default
  true.
- `waitFor` (`--wait-for`): URL targets. After `load`, wait for this selector to be attached. The
  default on Storybook iframes is "the story rendered or failed" (`body.sb-show-main`,
  `…errordisplay`, `…nopreview`). URL targets never wait for network idle, because the app keeps
  an EventSource open.
- `timeout` (`--timeout`, default 30000 ms): navigation and `waitFor` timeout for URL targets.
- `browser`: reuse one Chromium across calls.

Inside a Playwright test, `probePage(page, { selectors, limit, aria })` measures a page you already
have, but it doesn't theme the page or check it.

**Errors.** The result always has an `errors` array, and it is empty only when everything worked.
What counts as an error:
- the board failed to render;
- the URL document isn't 2xx;
- any page error;
- any failed request or HTTP ≥ 400 response, from any host for URLs (boards: the local server
  only, so a font CDN outage shows up in `fonts.missing` instead);
- a `waitFor` timeout;
- Storybook showing its error panel (an unknown story id or a story that throws);
- a theme that doesn't match the look.

Then `probe()` throws `ProbeError` with the full JSON on `error.result`, and the CLI still writes
the JSON (stdout or `--out`), prints each error to stderr and exits 1. Callers can't miss a broken
page. Bad arguments (unknown board or look, a conflicting `globals` pin) throw a plain `Error` /
exit 1 without JSON.

Schema 2 (keys always present, in this order; `viewport` onward are missing only when the page never
loaded, which always comes with `errors`):

```jsonc
{
  "schema": 2,
  "target": "Main.dc.html",                          // board file, or the URL as given
  "url": "redesign/mockups/Main.dc.html?look=Daylight", // boards: stable, no server port; URLs:
                                                     // the URL loaded, with the added globals
  "look": "daylight",
  "emulation": { "width": 1440, "height": 900, "touch": false, "motion": "reduce" },
  "errors": [],                                      // see Errors; non-empty = exit 1 / ProbeError
  "viewport": { "width": 1440, "height": 900 },
  "page": { "width": 1440, "height": 900 },          // document scroll size
  "display": {                                       // what was in effect (null = not set)
    "dataTheme": "light",                            // first [data-theme] (mockups)
    "appearance": null,                              // <html data-*> written by the app and
    "contrast": null, "distance": null,              //   Storybook (apps/web/app/ui/display.ts)
    "motion": null, "readingFont": null, "score": null
  },
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
          "fontWeight": "400", "fontStyle": "normal", "lineHeight": "21.75px",
          "letterSpacing": "normal", "textTransform": "none", "textAlign": "center",
          "margin": ["0px", "0px", "0px", "0px"],           // top, right, bottom, left
          "padding": ["1px", "6px", "1px", "6px"],          // top, right, bottom, left
          "borderWidth": ["0px", "0px", "0px", "0px"],      // top, right, bottom, left
          "borderStyle": ["none", "none", "none", "none"],
          "borderColor": ["…", "…", "…", "…"],
          "borderRadius": ["50%", "50%", "50%", "50%"],     // top-left, top-right, bottom-right, bottom-left
          "gap": ["normal", "normal"],                      // row, column
          "boxShadow": "…",
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
