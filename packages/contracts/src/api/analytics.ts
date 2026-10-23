import { z } from 'zod'
import { Instrument } from '../analysis/common.ts'
import { StageName } from '../analysis/stage.ts'
import { RecommendedView } from '../analysis/summary.ts'
import { AnalysisKind, AnalysisStatus } from './analyses.ts'
import { ExampleId } from './examples.ts'
import { Level } from './me.ts'
import { PaidPlan } from './plan.ts'
import { AttemptOutcome } from './practice.ts'

// Product events (16 §2), the personal-mode stand-in for PostHog: rows in analytics_events. Props
// never carry audio, titles, file names, URLs, emails or user ids: rows are keyed by a salted user
// hash (16 §6). Unknown props are stripped when an event is parsed, so only the keys below can
// reach the table. The typed track() wrapper is packages/analytics.

const Ms = z.number().int().nonnegative().max(86_400_000)
const Pct = z.number().int().min(25).max(200)
// `model_id@version`, e.g. "basic_pitch@0.4.0" (Trust dashboard: rates per model). Ids and
// versions are the stages' and the register's own ("bs_roformer:BS-Roformer-SW",
// "panns/cnn14@mAP=0.431", "0.17.dev0@27f032e"); no spaces, query strings or other free text.
const ModelTag = z.string().regex(/^[A-Za-z0-9_./:-]{1,80}@[A-Za-z0-9_.+=@-]{1,80}$/)
// Machine codes only (06 §3), never exception text.
const Code = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/)

export const OnboardingStep = z.enum(['instrument', 'level', 'screen', 'song', 'loop', 'save'])

// Where a learner met the paywall (23 §5: locks only at points of action).
export const PaywallTrigger = z.enum(['cap_lite', 'cap_full', 'lite_song', 'pricing', 'settings'])

// How a practice action was given (keyboard/pedal share, 16 §3 Practice quality); the names of
// practice sessions' input_mode.
export const InputMode = z.enum(['touch', 'keyboard', 'pedal'])

export const MixPresetName = z.enum(['part_loud', 'minus_one', 'original'])
export const PracticeLevel = z.enum([
  'chords_only',
  'simplified',
  'as_transcribed',
  'roots',
  'full',
])
export const BrowserFamily = z.enum(['chromium', 'firefox', 'webkit', 'other'])
export const DeviceClass = z.enum(['phone', 'tablet', 'desktop'])
export const BytesBucket = z.enum(['lt_10mb', 'lt_50mb', 'lt_200mb', 'gte_200mb'])

export const DisplaySettings = z.object({
  appearance: z.enum(['system', 'light', 'dark', 'stage']),
  score_surface: z.enum(['paper', 'match']),
  distance: z.enum(['desk', 'stand', 'floor', 'auto']),
  calibration_pct: z.number().int().min(50).max(200),
  hyperlegible: z.boolean(),
  reduced_motion: z.enum(['system', 'full', 'reduce']),
  contrast: z.enum(['system', 'normal', 'more']),
})

// Events the browser sends (POST /v1/events).
export const AnalyticsEvent = z.discriminatedUnion('name', [
  z.object({
    name: z.literal('onboarding_step_viewed'),
    props: z.object({
      step: OnboardingStep,
      instrument: Instrument.nullable(),
      level: Level.nullable(),
    }),
  }),
  z.object({ name: z.literal('example_song_opened'), props: z.object({ example_id: ExampleId }) }),
  z.object({
    name: z.literal('first_isolated_playback'),
    props: z.object({ ms_since_song_selected: Ms, source: z.enum(['example', 'upload']) }),
  }),
  z.object({
    name: z.literal('first_loop_reduced_speed'),
    props: z.object({ ms_since_landing: Ms, tempo_pct: z.number().int().min(25).max(99) }),
  }),
  z.object({
    name: z.literal('loop_created'),
    props: z.object({
      method: z.enum(['tap', 'numeric', 'drag', 'clip']),
      bars: z.number().int().min(1).max(999),
    }),
  }),
  z.object({
    name: z.literal('loop_pass_completed'),
    props: z.object({ tempo_pct: Pct, outcome: AttemptOutcome, input_mode: InputMode }),
  }),
  z.object({
    name: z.literal('speed_changed'),
    props: z.object({ speed_pct: Pct, input_mode: InputMode }),
  }),
  z.object({ name: z.literal('mix_preset_applied'), props: z.object({ preset: MixPresetName }) }),
  z.object({ name: z.literal('level_changed'), props: z.object({ level: PracticeLevel }) }),
  z.object({
    name: z.literal('view_changed'),
    props: z.object({ view: z.enum(['tab', 'notes', 'chords', 'glance']) }),
  }),
  z.object({
    name: z.literal('upload_started'),
    props: z.object({ source: z.enum(['file', 'recording']), bytes_bucket: BytesBucket }),
  }),
  z.object({
    name: z.literal('upload_completed'),
    props: z.object({ source: z.enum(['file', 'recording']), bytes_bucket: BytesBucket }),
  }),
  z.object({
    name: z.literal('upload_failed'),
    props: z.object({
      source: z.enum(['file', 'recording']),
      bytes_bucket: BytesBucket,
      error_code: Code,
    }),
  }),
  z.object({
    name: z.literal('link_import_started'),
    props: z.object({ type: z.enum(['full', 'lite']) }),
  }),
  z.object({
    name: z.literal('correction_made'),
    props: z.object({
      op: Code,
      entity: z.enum(['note', 'chord', 'beat', 'section']),
      model_ref: ModelTag.nullable(),
    }),
  }),
  z.object({
    name: z.literal('wrong_reported'),
    props: z.object({ entity: z.enum(['note', 'chord']), model_ref: ModelTag.nullable() }),
  }),
  z.object({ name: z.literal('paywall_viewed'), props: z.object({ trigger: PaywallTrigger }) }),
  z.object({
    name: z.literal('upgrade_clicked'),
    props: z.object({ trigger: PaywallTrigger, plan: PaidPlan }),
  }),
  z.object({ name: z.literal('display_settings_changed'), props: DisplaySettings }),
  z.object({
    name: z.literal('audio_underrun'),
    props: z.object({
      browser: BrowserFamily,
      device_class: DeviceClass,
      rate: z.number().min(0.25).max(2),
      preset: z.enum(['high', 'mid', 'low']),
    }),
  }),
  z.object({
    name: z.literal('in_app_browser_banner_viewed'),
    props: z.object({ app: z.enum(['instagram', 'facebook', 'tiktok', 'other']) }),
  }),
  z.object({
    name: z.literal('in_app_browser_opened_external'),
    props: z.object({ app: z.enum(['instagram', 'facebook', 'tiktok', 'other']) }),
  }),
  z.object({
    name: z.literal('capability_probe'),
    props: z.object({
      browser: BrowserFamily,
      device_class: DeviceClass,
      audio_worklet: z.boolean(),
      wasm_simd: z.boolean(),
      webcodecs: z.boolean(),
      opus_ok: z.boolean(),
      output_latency_ms: z.number().int().min(0).max(2000).nullable(),
      webgpu: z.boolean(),
      wake_lock: z.boolean(),
      midi: z.boolean(),
    }),
  }),
])

export const TrackInput = z.object({ events: z.array(AnalyticsEvent).min(1).max(20) })

// Events the API and the workers record directly (analytics repo / worker queue), never accepted
// from a browser.
export const ServerAnalyticsEvent = z.discriminatedUnion('name', [
  z.object({
    name: z.literal('analysis_requested'),
    props: z.object({
      type: AnalysisKind,
      instrument: Instrument,
      source: z.enum(['file', 'link']),
    }),
  }),
  z.object({
    name: z.literal('analysis_stage_completed'),
    props: z.object({
      stage: StageName,
      status: z.enum(['done', 'fallback', 'failed', 'skipped']),
      duration_ms: Ms.nullable(),
      model_ref: ModelTag.nullable(),
    }),
  }),
  z.object({
    name: z.literal('analysis_done'),
    props: z.object({
      status: AnalysisStatus,
      type: AnalysisKind,
      instrument: Instrument,
      total_ms: Ms,
      compute_ms: Ms,
      recommended_view: RecommendedView.nullable(),
      fallback_stages: z.array(StageName),
    }),
  }),
  z.object({ name: z.literal('checkout_completed'), props: z.object({ plan: PaidPlan }) }),
  z.object({
    name: z.literal('subscription_cancelled'),
    props: z.object({ tenure_days: z.number().int().nonnegative() }),
  }),
])
