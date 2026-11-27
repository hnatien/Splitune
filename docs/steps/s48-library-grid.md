# Step s48 — the library as tiles

Owner's request (2026-11-24), in their words: "my library page feels empty. can you redesign it? give me the mockup image first. you own the codebase and the design", then "im feeling like using Youtube's layout but optimize it so it fits our pattern", "can you use the video's image instead?", "this section [the lead] stays waveform" and "build it end to end. If the video has no image, then fallback to waveform."

| | |
|---|---|
| Branch | `impl/48-library-grid` from `dev` (`6e2d1d7`) |
| Spec | `docs/specs/27-screens-flows-and-content.md` §3.5 (rewritten by this step), `docs/specs/26-design-system.md` §12.2 (`WaveformBars`) |
| Contracts and DB | `LibrarySong.waveform`, `UpdateSongInput.waveform` (`SongWaveform`); migration `0016_song_waveform.sql` (one nullable `jsonb` column on `songs`) |
| Mockups | `apps/web/.impeccable/mocks/library/final-one-song.png`, `final-populated.png` (approved by the owner; the tile pictures in them are stand-ins) |

## Goal
A library with one song no longer reads as an empty page, and a library with many reads at a glance: every song has a picture.

## What to build
1. **Continue** leads with the last song's waveform in a 16:9 well, an ink line and "{time} · you stopped here" at the saved position, beside the title, the meta line, the notes, the sparkline and Resume practice (still the page's one filled control). No caption above the title; the section keeps its name for assistive tech.
2. **This week** is one row across the page between two hairlines.
3. **Songs are tiles**, three across from 1024 px, two from 640 px, one on phones, still grouped by what each needs. A tile's picture is the video's still for a song added from a YouTube link, else the song's waveform, else its instrument's drawing; the length and how far the learner got sit on it; a song that can't be played yet carries its state there.
4. **The waveform is data the song keeps:** the practice screen sends 96 loudness levels once it has decoded the audio. No pipeline or worker change.
5. **The last tile adds a song.** The toolbar appears from seven songs or while a filter is on, with the instruments the library has.

## Rules that hold
Doc 25 (no new service, no billable resource); the black-and-white system of docs 26–28 in both themes (the still is the song's own picture, not interface colour); state never by colour alone; every action keyboard operable; stories for each state in both themes; nothing weakened in the tests.

## Done when
`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm --filter @splitune/web test:stories` and the e2e suite pass; spec 27 §3.5, `docs/status.md` and `docs/progress-log.md` say what was built and what was not checked.
