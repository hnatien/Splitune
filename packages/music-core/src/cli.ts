// JSON-in/JSON-out CLI for the Python eval harness and language-neutral golden tests:
//   node src/cli.ts <fret|quantize|quantize-drums|build-tab|build-piano|build-drums|key> < input.json > output.json
// (or `pnpm --silent --filter @splitune/music-core cli <command>`). Invalid input exits with
// code 2 and an ErrorEnvelope-shaped JSON object on stderr.
import { Beats, Chords, CorrectionOp, DrumNotes, Notes } from '@splitune/contracts'
import { z } from 'zod'
import { buildTab } from './build-tab.ts'
import { applyBeatCorrections } from './corrections/apply.ts'
import { buildDrumScore } from './drums/build-drums.ts'
import { fretConfig } from './fret/config.ts'
import { assignFrets, groupIntoSteps } from './fret/dp.ts'
import { createBeatGrid } from './grid/beatgrid.ts'
import { estimateKey } from './harmony/key.ts'
import { buildPianoScore } from './piano/build-piano.ts'
import { quantizeDrumHits, quantizeNotes } from './quantize/quantize.ts'

const Ops = z.array(CorrectionOp)

const FretInput = z.object({
  notes: z.array(
    z.object({
      id: z.string().min(1),
      onset_s: z.number().nonnegative(),
      offset_s: z.number().nonnegative().optional(),
      pitch_midi: z.number().int().min(0).max(127),
      string: z.number().int().min(1).max(7).optional(),
      fret: z.number().int().min(0).max(24).optional(),
    }),
  ),
  chords: z.array(z.object({ t0: z.number(), t1: z.number(), label: z.string() })).optional(),
  config: z
    .object({
      instrument: z.enum(['guitar', 'bass']).optional(),
      tuning_midi: z.array(z.number().int()).optional(),
      capo: z.number().int().optional(),
      max_fret: z.number().int().optional(),
      max_span: z.number().int().optional(),
      mode: z.enum(['easiest', 'as_played']).optional(),
      hand_position_prior: z.number().optional(),
      weights: z.record(z.string(), z.number()).optional(),
    })
    .optional(),
  chord_window_s: z.number().nonnegative().optional(),
})

const QuantizeInput = z.object({
  notes: Notes,
  beats: Beats,
  corrections: z.object({ beats: Ops.optional() }).optional(),
})

const QuantizeDrumsInput = z.object({
  drums: DrumNotes,
  beats: Beats,
  corrections: z.object({ beats: Ops.optional() }).optional(),
})

const BuildTabInput = z.object({
  notes: Notes,
  beats: Beats,
  chords: Chords.optional(),
  corrections: z
    .object({
      notes: Ops.optional(),
      beats: Ops.optional(),
      chords: Ops.optional(),
      beats_rev: z.number().int().nonnegative().optional(),
    })
    .optional(),
  options: z
    .object({
      tuning_midi: z.array(z.number().int()).optional(),
      capo: z.number().int().optional(),
      max_fret: z.number().int().optional(),
      max_span: z.number().int().optional(),
      fingering_mode: z.enum(['easiest', 'as_played']).optional(),
      level: z.enum(['chords_only', 'simplified', 'as_transcribed', 'roots', 'full']).optional(),
      transpose: z
        .object({ semitones: z.number().int(), keep_shapes: z.boolean().optional() })
        .optional(),
      title: z.string().optional(),
      chord_names: z.boolean().optional(),
      weights: z.record(z.string(), z.number()).optional(), // FretWeights overrides (eval sweeps)
    })
    .optional(),
})

const BuildPianoInput = z.object({
  notes: Notes,
  beats: Beats,
  chords: Chords.optional(),
  corrections: z
    .object({ notes: Ops.optional(), beats: Ops.optional(), chords: Ops.optional() })
    .optional(),
  options: z.object({ title: z.string().optional() }).optional(),
})

const BuildDrumsInput = z.object({
  drums: DrumNotes,
  beats: Beats,
  corrections: z.object({ beats: Ops.optional() }).optional(),
  options: z
    .object({
      level: z.enum(['as_transcribed', 'core_groove', 'simplified']).optional(),
      title: z.string().optional(),
    })
    .optional(),
})

function defined<T extends object>(value: T): { [K in keyof T]: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as {
    [K in keyof T]: Exclude<T[K], undefined>
  }
}

export function runFret(raw: unknown): unknown {
  const input = FretInput.parse(raw)
  const c = input.config ?? {}
  const config = fretConfig(
    defined({
      instrument: c.instrument,
      tuningMidi: c.tuning_midi,
      capo: c.capo,
      maxFret: c.max_fret,
      maxSpan: c.max_span,
      mode: c.mode,
      handPositionPrior: c.hand_position_prior,
      weights: c.weights,
    }),
  )
  const chords = input.chords ?? []
  const groups = groupIntoSteps(input.notes, input.chord_window_s ?? 0.03)
  const steps = groups.map((group) => {
    const time = (group[0] as (typeof group)[number]).onset_s
    const chord = chords.find((s) => s.t0 <= time && time < s.t1)?.label
    return {
      time,
      notes: group.map((n) =>
        defined({
          id: n.id,
          pitch: n.pitch_midi,
          endTime: n.offset_s,
          pin:
            n.string !== undefined && n.fret !== undefined
              ? { string: n.string, fret: n.fret }
              : undefined,
        }),
      ),
      ...(chord === undefined ? {} : { chord }),
    }
  })
  const assignments = assignFrets(steps, config).flat()
  return {
    assignments: assignments.map((a) =>
      defined({
        note_id: a.noteId,
        string: a.string,
        fret: a.fret,
        sounding_pitch: a.soundingPitch,
        unplayable: a.unplayable,
        alt_fingerings: a.altFingerings,
      }),
    ),
  }
}

export function runQuantize(raw: unknown): unknown {
  const input = QuantizeInput.parse(raw)
  const beats = applyBeatCorrections(input.beats, input.corrections?.beats ?? []).value
  const result = quantizeNotes(input.notes.notes, createBeatGrid(beats))
  return {
    events: result.notes.map((q) => ({
      note_id: q.noteId,
      bar: q.bar,
      beat: q.beat,
      tick: q.tick,
      duration_ticks: q.durationTicks,
      quantize_residual_ms: Math.round(q.residualMs * 10) / 10,
      residual_flagged: q.residualFlagged,
    })),
    swing_bars: result.swingBars,
  }
}

export function runQuantizeDrums(raw: unknown): unknown {
  const input = QuantizeDrumsInput.parse(raw)
  const beats = applyBeatCorrections(input.beats, input.corrections?.beats ?? []).value
  const result = quantizeDrumHits(input.drums.hits, createBeatGrid(beats))
  return {
    hits: result.hits.map((q) => ({
      hit_id: q.hitId,
      merged_ids: q.mergedIds,
      class5: q.class5,
      gm_note: q.gmNote,
      bar: q.bar,
      beat: q.beat,
      tick: q.tick,
      quantize_residual_ms: Math.round(q.residualMs * 10) / 10,
      residual_flagged: q.residualFlagged,
      flam: q.flam,
    })),
    swing_bars: result.swingBars,
  }
}

export function runBuildTab(raw: unknown): unknown {
  const input = BuildTabInput.parse(raw)
  const o = input.options ?? {}
  const c = input.corrections ?? {}
  const result = buildTab(
    input.notes,
    input.beats,
    defined({ notes: c.notes, beats: c.beats, chords: c.chords, beatsRev: c.beats_rev }),
    defined({
      chords: input.chords,
      tuningMidi: o.tuning_midi,
      capo: o.capo,
      maxFret: o.max_fret,
      maxSpan: o.max_span,
      fingeringMode: o.fingering_mode,
      level: o.level,
      transpose:
        o.transpose === undefined
          ? undefined
          : defined({ semitones: o.transpose.semitones, keepShapes: o.transpose.keep_shapes }),
      title: o.title,
      chordNames: o.chord_names,
      weights: o.weights,
    }),
  )
  return {
    tab: result.tab,
    alphatex: result.alphaTex,
    note_map: result.noteMap,
    warnings: result.warnings,
  }
}

// Piano notes with their hands, and the grand staff (21 V4).
export function runBuildPiano(raw: unknown): unknown {
  const input = BuildPianoInput.parse(raw)
  const c = input.corrections ?? {}
  const result = buildPianoScore(
    input.notes,
    input.beats,
    defined({ notes: c.notes, beats: c.beats, chords: c.chords }),
    defined({ chords: input.chords, title: input.options?.title }),
  )
  return {
    notes: result.notes.map((n) => ({
      note_id: n.id,
      pitch: n.pitch,
      hand: n.hand,
      on_tick: n.onTick,
      off_tick: n.offTick,
      residual_flagged: n.residualFlagged,
    })),
    swing_bars: result.swingBars,
    alphatex: result.alphaTex,
    note_map: result.noteMap,
  }
}

// Drum hits at a level on the beat grid, and the drum staff (step 25).
export function runBuildDrums(raw: unknown): unknown {
  const input = BuildDrumsInput.parse(raw)
  const result = buildDrumScore(
    input.drums,
    input.beats,
    defined({ beats: input.corrections?.beats }),
    defined({ level: input.options?.level, title: input.options?.title }),
  )
  return {
    level: result.level,
    hits: result.hits.map((h) => ({
      hit_id: h.id,
      class5: h.class5,
      gm_note: h.gmNote,
      on_tick: h.onTick,
      bar: h.bar,
      beat: h.beat,
      tick: h.tick,
      approximate: h.approximate,
      flam: h.flam,
      foot: h.foot,
      generated: h.generated,
    })),
    fill_bars: result.fillBars,
    swing_bars: result.swingBars,
    alphatex: result.alphaTex,
    hit_map: result.hitMap,
  }
}

// Key from chord segments (and optionally notes): the music-core estimator for the chords stage.
const KeyInput = z.object({
  segments: Chords.shape.segments,
  notes: z
    .array(
      z.object({
        pitch_midi: z.number().int(),
        onset_s: z.number().nonnegative(),
        offset_s: z.number().nonnegative(),
      }),
    )
    .optional(),
})

export function runKey(raw: unknown): unknown {
  const input = KeyInput.parse(raw)
  const { tonic, mode, confidence } = estimateKey(input.segments, input.notes ?? [])
  return { tonic, mode, confidence }
}

export const COMMANDS: Readonly<Record<string, (raw: unknown) => unknown>> = {
  fret: runFret,
  quantize: runQuantize,
  'quantize-drums': runQuantizeDrums,
  'build-tab': runBuildTab,
  'build-piano': runBuildPiano,
  'build-drums': runBuildDrums,
  key: runKey,
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

function fail(code: string, message: string, details?: unknown): never {
  process.stderr.write(
    `${JSON.stringify({ error: { code, message, ...(details === undefined ? {} : { details }) } })}\n`,
  )
  process.exit(2)
}

async function main(): Promise<void> {
  const name = process.argv[2] ?? ''
  const command = COMMANDS[name]
  if (command === undefined)
    fail(
      'validation_failed',
      `unknown command "${name}"; expected ${Object.keys(COMMANDS).join(', ')}`,
    )
  let raw: unknown
  try {
    raw = JSON.parse(await readStdin())
  } catch {
    fail('validation_failed', 'stdin is not valid JSON')
  }
  try {
    process.stdout.write(`${JSON.stringify(command(raw))}\n`)
  } catch (error) {
    if (error instanceof z.ZodError)
      fail('validation_failed', 'input does not match the contract', { issues: error.issues })
    if (error instanceof RangeError) fail('validation_failed', error.message)
    throw error
  }
}

if (import.meta.main) await main()
