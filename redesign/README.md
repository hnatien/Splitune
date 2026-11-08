# Redesign: Night Rehearsal

Ground-up UI/UX redesign of Splitune. Direction A, "Night Rehearsal", was chosen on 2026-11-08: dark warm graphite surfaces, one amber accent reserved for now/playhead/loop/primary action, and a "Daylight" light theme built from the same tokens. Once the redesign's Phase 0 lands, it replaces the "Music Stand" rules in `docs/specs/26`–`28`.

| Path | What it is |
|---|---|
| `report.md` | Research report and the full redesign plan (phases 0–7, acceptance criteria, risks). |
| `research/` | Evidence notes behind the report: stem/practice players, notation and learning apps, practice science and hands-free use, AI confidence and processing UX, visual direction. `product_inventory.md` is the functional inventory of every current screen, state and gap. |
| `mockups/` | Source of the 25 mockups: one `*.dc.html` per screen, `splitune.css` (tokens and component classes, the visual source of truth), `canvas.json` (canvas layout and board titles). |

The `*.dc.html` files are Design-canvas components: markup with `{{holes}}` filled by `renderVals()` in each file's script block, styled by `splitune.css`. They need the canvas runtime to render, so view them on the owner's canvas: https://claude.ai/artifact/MhnS5qHTrKwbpngxXeQsUB (private).
