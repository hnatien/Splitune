import type { LoopClip } from '@splitune/contracts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useActorRef, useSelector } from '@xstate/react'
import type * as React from 'react'
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { z } from 'zod'
import { client, orpc } from '@/lib/api'
import { usePlaybackActive } from '@/lib/app-state'
import { usePracticeDefaults } from '@/lib/display-store'
import { formatPercent } from '@/lib/format'
import { m } from '@/lib/i18n'
import { track, trackCorrection } from '@/lib/track'
import { toast } from '@/ui/toast'
import { localFile } from '../import/local-files'
import {
  applyCorrection,
  configureCorrections,
  dismissRejected,
  hydrateCorrections,
  redoCorrection,
  undoCorrection,
  useCorrections,
} from './model/corrections'
import {
  type ArtefactEntry,
  type PracticeData,
  sourceBytes,
  stemBytes,
  usePracticeData,
} from './model/data'
import type { Edit } from './model/edits'
import { type PracticeGrid, practiceGrid } from './model/grid'
import { defaultLevel, levelsFor } from './model/levels'
import { barRange, clipBeats, type LoopRange, restSeconds, tapBar } from './model/loops'
import {
  type Mix,
  type MixChannel,
  type MixPreset,
  mixChannels,
  presetMix,
  resolveMix,
} from './model/mixer'
import type { MusicInput, MusicOptions, MusicOutput } from './model/music'
import { type PlayerContext, type PlayerState, playerMachine } from './model/player-machine'
import { createResumeWriter, type ResumeState } from './model/player-state'
import { type AudioInput, type Lane, PracticeAudio } from './model/practice-audio'
import {
  endSession,
  flushPractice,
  lastInput,
  noteInput,
  recordAttempt,
  startSession,
} from './model/practice-sync'
import { type MusicState, useMusic } from './model/use-music'
import { buildViewModel, type ViewModel } from './model/view-model'
import { INITIAL_UI, showHud, usePracticeUi } from './practice-store'

// PracticeProvider (12 §2): the player machine, the audio adapter, the effective music from the
// Worker and everything that persists (resume state, clips, passes, corrections). Components read
// it through usePractice() and send intents; only the machine talks to the engine.

type Clip = z.infer<typeof LoopClip>

export interface PracticeSearch {
  view?: 'tab' | 'chords' | undefined
  loop?: string | undefined
  speed?: number | undefined
  mix?: 'your-part' | 'minus-one' | 'original' | undefined
  /** The level toggle's start (07 §6); ignored if the song's instrument has no such level. */
  level?: MusicOptions['level'] | undefined
}

export type AudioStatus = 'none' | 'loading' | 'ready' | 'failed'

export interface Layers {
  beats: boolean
  stems: boolean
  chords: boolean
  tab: boolean
}

export interface PracticeValue {
  songId: string
  /** A visitor's example song, kept on the device until they sign in (13 §1). */
  guest: boolean
  data: PracticeData
  audio: PracticeAudio
  audioStatus: AudioStatus
  lanes: Lane[]
  state: PlayerState
  player: PlayerContext
  send: ReturnType<typeof useActorRef<typeof playerMachine>>['send']
  music: MusicOutput | undefined
  musicState: MusicState
  grid: PracticeGrid | undefined
  view: ViewModel | undefined
  layers: Layers
  channels: MixChannel[]
  mix: Mix
  setMix: (mix: Mix) => void
  applyPreset: (preset: MixPreset) => void
  options: MusicOptions
  setOptions: (patch: Partial<MusicOptions>) => void
  clips: Clip[]
  clip: Clip | undefined
  best: number | null
  tapBar: (bar: number) => void
  /** `method`: how the learner made a new loop (16 §2 loop_created); none for adjustments. */
  setLoop: (range: LoopRange | null, method?: 'tap' | 'numeric' | 'clip') => void
  togglePlay: () => void
  restart: () => void
  stepBar: (direction: 1 | -1) => void
  setSpeed: (pct: number) => void
  markPass: (outcome: 'clean' | 'not_yet') => void
  edit: (edit: Edit) => void
  undo: () => void
  redo: () => void
  hearBar: (bar: number) => void
  artefactFor: (kind: Edit['kind']) => ArtefactEntry | undefined
}

const Context = createContext<PracticeValue | null>(null)

export function usePractice(): PracticeValue {
  const value = useContext(Context)
  if (!value) throw new Error('usePractice must be used inside PracticeProvider')
  return value
}

const BUSY: PlayerState[] = ['countIn', 'playing', 'loopRest', 'assess', 'audition']

function parseLoopParam(param: string | undefined, grid: PracticeGrid): LoopRange | null {
  const match = param?.match(/^(\d+)-(\d+)$/)
  if (!match) return null
  // URL bars are 1-based (27 §5.3).
  return barRange(grid, Number(match[1]) - 1, Number(match[2]) - 1)
}

const PRESET_PARAM: Record<NonNullable<PracticeSearch['mix']>, MixPreset> = {
  'your-part': 'part-loud',
  'minus-one': 'minus-one',
  original: 'original',
}

/** Where audio bytes come from: a stem's file, this page's own file or the song's audio. */
export type AudioRequest =
  | { kind: 'stem'; artefactId: string; stemId: string }
  | { kind: 'local'; file: File }
  | { kind: 'source'; songId: string }

export type FetchAudio = (request: AudioRequest, signal: AbortSignal) => Promise<ArrayBuffer>

const fetchFromApi: FetchAudio = (request, signal) =>
  request.kind === 'stem'
    ? stemBytes(request.artefactId, request.stemId, signal)
    : request.kind === 'local'
      ? request.file.arrayBuffer()
      : sourceBytes(request.songId, signal)

export function PracticeProvider({
  songId,
  search,
  guest = false,
  fetchAudio = fetchFromApi,
  children,
}: {
  songId: string
  search: PracticeSearch
  guest?: boolean
  /** The API by default; stories pass generated audio. */
  fetchAudio?: FetchAudio
  children: React.ReactNode
}) {
  const data = usePracticeData(songId)
  const queryClient = useQueryClient()
  const defaults = usePracticeDefaults()
  const [audio] = useState(() => new PracticeAudio())
  const actor = useActorRef(playerMachine, {
    input: {
      engine: audio,
      speedPct: defaults.speedPct,
      countInBars: defaults.countInBars,
      rest: defaults.restBetween,
    },
  })
  const state = useSelector(actor, (snapshot) => snapshot.value as PlayerState)
  const player = useSelector(actor, (snapshot) => snapshot.context)
  const instrument = data.instrument
  const [options, setOptionsState] = useState<MusicOptions>(() => ({
    capo: 0,
    level: defaultLevel(instrument),
    fingeringMode: 'easiest',
  }))

  // One practice screen at a time: fresh UI state, the stored edits, a session and the wake lock.
  useEffect(() => {
    usePracticeUi.setState(INITIAL_UI)
    configureCorrections({ queryClient })
    void hydrateCorrections()
    startSession(songId)
    void audio.keepScreenOn().catch(() => undefined)
    return () => {
      endSession()
      void audio.dispose()
    }
  }, [songId, audio, queryClient])

  // Effective music: recomputed in the Worker when an input it depends on changes.
  const beatsDoc = data.beats.data
  const input: MusicInput | undefined = beatsDoc
    ? {
        beats: beatsDoc,
        chords: data.chords.data,
        notes: data.notes.data,
        ops: { beats: data.ops.beats.ops, chords: data.ops.chords.ops, notes: data.ops.notes.ops },
        beatsRev: data.ops.beats.rev,
        options,
      }
    : undefined
  const opsReady = data.ops.beats.ready && data.ops.chords.ready && data.ops.notes.ready
  const musicKey =
    input && opsReady
      ? JSON.stringify([
          data.entry.beats?.id,
          data.entry.chords?.id,
          data.notes.data ? data.entry.notes?.id : null,
          data.chords.data ? 1 : 0,
          input.ops,
          input.beatsRev,
          options,
        ])
      : ''
  const musicState = useMusic(input, musicKey)
  const music = musicState.music
  const effectiveBeats = music?.beats ?? beatsDoc
  const grid = useMemo(
    () => (effectiveBeats ? practiceGrid(effectiveBeats) : undefined),
    [effectiveBeats],
  )
  const view = useMemo(
    () => (music && grid ? buildViewModel(music, grid) : undefined),
    [music, grid],
  )
  const channels = useMemo(
    () => (data.stems.data ? mixChannels(data.stems.data, instrument) : []),
    [data.stems.data, instrument],
  )

  // Audio: the stems when both sides exist, else this page's own file, else the song's audio.
  const local = localFile(songId)
  // A file's audio exists once its analysis does; a link's once url_import has downloaded it. An
  // example song has no audio of its own, only its stems.
  const download = data.analysis.data?.stages['url_import']?.status
  const sourceKind = data.song.data?.source_kind
  const hasSource =
    sourceKind === 'url'
      ? download === 'done' || download === 'fallback'
      : sourceKind !== 'example' &&
        Boolean(data.song.data?.latest_analysis || data.upload?.analysisId)
  const targetKey =
    channels.length > 0 && data.entry.stems
      ? `stems:${data.entry.stems.id}`
      : local
        ? 'local'
        : hasSource
          ? 'source'
          : ''
  const [audioStatus, setAudioStatus] = useState<AudioStatus>('none')
  const [lanes, setLanes] = useState<Lane[]>([])
  const layers: Layers = {
    beats: grid !== undefined,
    // Once the stems are decoded and playing through the mixer, not just listed.
    stems: lanes.some((lane) => lane.role === 'part'),
    chords: (view?.chords.length ?? 0) > 0,
    tab: data.entry.tab !== undefined && music?.tab !== undefined,
  }
  // The load in flight (or done) and its key: a re-render never cancels it, a new source does.
  const loading = useRef<{ key: string; abort: AbortController } | null>(null)
  const busy = BUSY.includes(state)
  useEffect(() => {
    usePlaybackActive.setState({ active: busy })
  }, [busy])
  useEffect(() => () => usePlaybackActive.setState({ active: false }), [])
  useEffect(() => {
    // Never swap audio under the learner's hands: a new source waits until playback stops.
    if (!targetKey || loading.current?.key === targetKey || busy) return
    const replacing = loading.current !== null
    loading.current?.abort.abort()
    const abort = new AbortController()
    loading.current = { key: targetKey, abort }
    if (replacing) actor.send({ type: 'UNLOADED' })
    setAudioStatus('loading')
    void (async () => {
      let inputs: AudioInput[]
      let duration: number | undefined
      const stems = data.entry.stems
      if (targetKey.startsWith('stems:') && stems && data.stems.data) {
        inputs = await Promise.all(
          channels.map(async (c) => ({
            id: c.stemId,
            role: c.role,
            bytes: await fetchAudio(
              { kind: 'stem', artefactId: stems.id, stemId: c.stemId },
              abort.signal,
            ),
          })),
        )
        duration = data.stems.data.duration_s
      } else if (targetKey === 'local' && local) {
        inputs = [
          {
            id: 'mix',
            role: 'mix',
            bytes: await fetchAudio({ kind: 'local', file: local }, abort.signal),
          },
        ]
      } else {
        inputs = [
          {
            id: 'mix',
            role: 'mix',
            bytes: await fetchAudio({ kind: 'source', songId }, abort.signal),
          },
        ]
      }
      const prepared = await audio.prepare(inputs, duration)
      if (abort.signal.aborted) return
      setLanes(prepared)
      setAudioStatus('ready')
      actor.send({ type: 'LOADED' })
    })().catch(() => {
      if (abort.signal.aborted) return
      // The source may not be in storage yet (upload in another tab): try again on a change.
      loading.current = null
      setAudioStatus('failed')
    })
  }, [
    targetKey,
    busy,
    actor,
    audio,
    channels,
    data.entry.stems,
    data.stems.data,
    local,
    songId,
    fetchAudio,
  ])
  useEffect(() => () => loading.current?.abort.abort(), [])

  useEffect(() => {
    if (data.song.data) audio.setTitle(data.song.data.title)
  }, [audio, data.song.data])

  // Beat grid → engine (count-in, metronome, beat events) and machine.
  useEffect(() => {
    if (!effectiveBeats) return
    audio.setBeats(effectiveBeats.beats.map((b) => ({ time: b.t, downbeat: b.is_downbeat })))
    actor.send({ type: 'SET_BEATS', hasBeats: true })
  }, [effectiveBeats, audio, actor])

  // The mix: saved per stem in player_state; the engine gets linear gains.
  const [savedMix, setSavedMix] = useState<Mix | undefined>(undefined)
  const mix = useMemo(() => resolveMix(channels, savedMix), [channels, savedMix])
  const stemsLoaded = lanes.length > 1
  // "Hear this bar" plays the original mix (27 §3.7.4), then the learner's mix comes back.
  const heard = state === 'audition' ? presetMix(channels, 'original') : mix
  useEffect(() => {
    audio.setMixer(
      stemsLoaded
        ? channels.map((c) => {
            const s = heard[c.stemId] ?? { gain_db: 0, muted: false, solo: false }
            return { gainDb: s.gain_db, muted: s.muted, soloed: s.solo, soloGainDb: c.soloGainDb }
          })
        : [{ gainDb: 0, muted: false, soloed: false }],
    )
  }, [audio, channels, heard, stemsLoaded])

  // Loop clips (12 §5): the active loop is a clip so it survives a reload; an unnamed clip is
  // reused for the next loop instead of piling up.
  const clipsQuery = useQuery(orpc.loops.list.queryOptions({ input: { id: songId } }))
  const clips = clipsQuery.data?.items ?? []
  const [clipId, setClipId] = useState<string | null>(null)
  const clip = clips.find((c) => c.id === clipId)
  const [best, setBest] = useState<number | null>(null)
  useEffect(() => setBest(clip?.best_clean_tempo_pct ?? null), [clip?.best_clean_tempo_pct])
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const persistLoop = (range: LoopRange) => {
    if (!grid) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const fields = { ...clipBeats(grid, range), start_s: range.start, end_s: range.end }
      const reuse = clip && clip.name === null ? clip.id : null
      const request = reuse
        ? client.loops.update({ id: songId, loop_id: reuse, ...fields })
        : client.loops.create({
            id: songId,
            ...fields,
            count_in_bars: player.countInBars,
            rest_between: player.rest,
          })
      void request
        .then((saved) => {
          setClipId(saved.id)
          return queryClient.invalidateQueries({
            queryKey: orpc.loops.list.queryKey({ input: { id: songId } }),
          })
        })
        .catch(() => undefined)
    }, 500)
  }

  const setLoop = (range: LoopRange | null, method?: 'tap' | 'numeric' | 'clip') => {
    actor.send({ type: 'SET_LOOP', loop: range })
    if (range && method) {
      track('loop_created', { method, bars: range.endBar - range.startBar + 1 })
    }
    usePracticeUi.setState({ promptPass: 0 })
    if (range) {
      actor.send({
        type: 'SET_REST',
        rest: player.rest,
        restSeconds: restSeconds(grid ?? null, range, player.rest),
      })
      persistLoop(range)
      setBest(null)
    } else {
      setClipId(null)
    }
  }

  // Resume (13 §5): search params first (bookmarkable), then the song's player_state.
  const resumed = useRef(false)
  useEffect(() => {
    const song = data.song.data
    if (resumed.current || !song || !clipsQuery.isFetched) return
    // A saved clip or a ?loop= needs the bars, so wait for the beat grid when the song has one.
    if ((song.player_state.selected_loop_id || search.loop) && !grid && data.entry.beats) return
    resumed.current = true
    const saved = song.player_state
    // The level toggle starts at the requested level, or the instrument's default once known.
    const levels = levelsFor(song.instrument)
    const level =
      search.level && levels.includes(search.level)
        ? search.level
        : levels.includes(options.level)
          ? undefined
          : defaultLevel(song.instrument)
    if (level) setOptionsState((current) => ({ ...current, level }))
    const speed = search.speed ?? saved.speed_pct
    if (speed !== undefined) actor.send({ type: 'SET_SPEED', pct: speed })
    setSavedMix(
      search.mix && channels.length > 0
        ? presetMix(channels, PRESET_PARAM[search.mix])
        : (saved.mix as Mix | undefined),
    )
    const viewChoice = search.view ?? (saved.view === 'chords_only' ? 'chords' : undefined)
    if (viewChoice === 'tab') usePracticeUi.setState({ forceTab: true })
    const fromUrl = grid ? parseLoopParam(search.loop, grid) : null
    const savedClip = clips.find((c) => c.id === saved.selected_loop_id)
    if (fromUrl) {
      setLoop(fromUrl)
    } else if (savedClip) {
      setClipId(savedClip.id)
      actor.send({
        type: 'SET_LOOP',
        loop: {
          startBar: savedClip.start_bar,
          endBar: savedClip.end_bar,
          start: savedClip.start_s,
          end: savedClip.end_s,
        },
      })
      actor.send({
        type: 'SET_COUNT_IN',
        on: savedClip.count_in_bars > 0,
        bars: Math.max(1, savedClip.count_in_bars),
      })
    }
    if (saved.position_s !== undefined) actor.send({ type: 'SEEK', seconds: saved.position_s })
  })

  // Resume state out: debounced whole-state PATCH, and a keepalive send when the page goes.
  const [writer] = useState(() => createResumeWriter(songId))
  const forceTab = usePracticeUi((s) => s.forceTab)
  const resumeState: ResumeState = {
    speed_pct: player.speedPct,
    ...(channels.length > 0 ? { mix } : {}),
    ...(forceTab ? { view: 'tab' as const } : {}),
    selected_loop_id: clipId,
  }
  const resumeKey = JSON.stringify(resumeState)
  useEffect(() => {
    if (!resumed.current) return
    writer.write({ ...(JSON.parse(resumeKey) as ResumeState), position_s: audio.position() })
  }, [resumeKey, writer, audio])
  useEffect(() => {
    if (!resumed.current || busy) return
    writer.write({ ...(JSON.parse(resumeKey) as ResumeState), position_s: audio.position() })
  }, [busy, resumeKey, writer, audio])
  useEffect(() => {
    const leave = () => {
      writer.flush()
      void flushPractice()
    }
    window.addEventListener('pagehide', leave)
    return () => {
      window.removeEventListener('pagehide', leave)
      leave()
    }
  }, [writer])

  // Engine events → machine, pass prompt and the visual beat counter.
  useEffect(() => {
    audio.onEvent((event) => {
      switch (event.type) {
        case 'started':
          actor.send({ type: 'ENGINE.STARTED' })
          usePracticeUi.setState({ beat: null })
          return
        case 'loopWrap':
        case 'stopReached': {
          actor.send({
            type: event.type === 'loopWrap' ? 'ENGINE.LOOP_WRAP' : 'ENGINE.STOP_REACHED',
          })
          const snapshot = actor.getSnapshot()
          if (snapshot.value !== 'audition' && snapshot.context.loop) {
            usePracticeUi.setState({ promptPass: snapshot.context.pass })
          }
          return
        }
        case 'ended':
          actor.send({ type: 'ENGINE.ENDED' })
          return
        case 'underrun':
          track('audio_underrun', {
            rate: actor.getSnapshot().context.speedPct / 100,
            preset: event.event.tier,
          })
          return
        case 'interrupted':
          actor.send({ type: 'ENGINE.INTERRUPTED' })
          return
        case 'countIn': {
          const delay = Math.max(0, event.at - performance.now())
          setTimeout(
            () =>
              usePracticeUi.setState({
                beat: { index: event.index, accent: event.accent, countIn: true },
              }),
            delay,
          )
          return
        }
        default:
          return
      }
    })
  }, [audio, actor])

  const setMix = (next: Mix) => setSavedMix(next)
  const applyPreset = (preset: MixPreset) => {
    setSavedMix(presetMix(channels, preset))
    track('mix_preset_applied', {
      preset:
        preset === 'part-loud' ? 'part_loud' : preset === 'minus-one' ? 'minus_one' : 'original',
    })
    showHud(
      preset === 'part-loud'
        ? m['mixer.preset_part_loud']()
        : preset === 'minus-one'
          ? m['mixer.preset_minus_one']()
          : m['mixer.preset_original'](),
    )
  }

  const setSpeed = (pct: number) => {
    const clamped = Math.min(100, Math.max(50, Math.round(pct)))
    actor.send({ type: 'SET_SPEED', pct: clamped })
    track('speed_changed', { speed_pct: clamped, input_mode: lastInput() })
    showHud(m['practice.hud_speed']({ speed: formatPercent(clamped) }))
  }

  const togglePlay = () => {
    actor.send({ type: 'TOGGLE' })
  }

  const restart = () => {
    const loop = player.loop
    if (loop && player.loopOn) {
      actor.send({ type: 'RESTART' })
      showHud(m['practice.hud_restart']())
    } else if (grid) {
      stepBar(-1)
    } else {
      actor.send({ type: 'SEEK', seconds: 0 })
    }
  }

  const stepBar = (direction: 1 | -1) => {
    if (!grid) return
    const now = audio.position()
    const { bar } = grid.positionAt(now)
    // Back: to this bar's start, or the previous bar's when already near the start.
    const nearStart = now - grid.barStart(bar) < 0.5
    const target = direction === 1 ? bar + 1 : nearStart ? Math.max(grid.firstBar, bar - 1) : bar
    actor.send({ type: 'SEEK', seconds: grid.barStart(Math.min(grid.lastBar, target)) })
    showHud(m['practice.hud_bar']({ bar: String(Math.min(grid.lastBar, target) + 1) }))
  }

  const markPass = (outcome: 'clean' | 'not_yet') => {
    recordAttempt({ loopClipId: clip?.id, tempoPct: player.speedPct, outcome })
    track('loop_pass_completed', { tempo_pct: player.speedPct, outcome, input_mode: lastInput() })
    if (outcome === 'clean') setBest((previous) => Math.max(previous ?? 0, player.speedPct))
    usePracticeUi.setState({ promptPass: 0 })
    if (state === 'assess') actor.send({ type: 'ASSESSED' })
    showHud(outcome === 'clean' ? m['practice.felt_clean']() : m['practice.not_yet']())
  }

  const artefactFor = (kind: Edit['kind']) =>
    kind === 'chords' ? data.entry.chords : kind === 'notes' ? data.entry.notes : data.entry.beats

  const edit = (change: Edit) => {
    const target = artefactFor(change.kind)
    if (!target) return
    applyCorrection(target.id, change.op, change.inverse)
    const doc =
      change.kind === 'chords'
        ? data.chords.data
        : change.kind === 'notes'
          ? data.notes.data
          : data.beats.data
    const model = doc?.models[0]
    trackCorrection(change.kind, change.op.op, model)
    if (change.inverse === null) {
      toast.add({ title: m['editor.reported']() })
      return
    }
    toast.add({
      title: m['editor.saved'](),
      actionProps: { children: m['editor.undo'](), onClick: () => undoCorrection() },
    })
  }

  // Refused ops roll back with a notice (26 §13).
  const rejected = useCorrections((s) => s.rejected)
  useEffect(() => {
    if (rejected === 0) return
    toast.add({ title: m['editor.rejected'](), type: 'error' })
    dismissRejected()
  }, [rejected])

  const hearBar = (bar: number) => {
    if (!grid) return
    actor.send({ type: 'AUDITION', start: grid.barStart(bar), end: grid.barEnd(bar) })
  }

  const value: PracticeValue = {
    songId,
    guest,
    data,
    audio,
    audioStatus,
    lanes,
    state,
    player,
    send: actor.send,
    music,
    musicState,
    grid,
    view,
    layers,
    channels,
    mix,
    setMix,
    applyPreset,
    options,
    setOptions: (patch) => setOptionsState((current) => ({ ...current, ...patch })),
    clips,
    clip,
    best,
    tapBar: (bar) => {
      if (!grid) return
      noteInput('touch')
      const next = tapBar(usePracticeUi.getState().selection, bar, grid)
      usePracticeUi.setState({ selection: next })
      if (next.kind === 'active') {
        setLoop(next.range, 'tap')
        showHud(
          m['practice.hud_loop']({
            bars: `${next.range.startBar + 1}–${next.range.endBar + 1}`,
          }),
        )
      }
    },
    setLoop,
    togglePlay,
    restart,
    stepBar,
    setSpeed,
    markPass,
    edit,
    undo: () => {
      if (undoCorrection()) showHud(m['editor.undone']())
    },
    redo: () => {
      if (redoCorrection()) showHud(m['editor.redone']())
    },
    hearBar,
    artefactFor,
  }
  return <Context.Provider value={value}>{children}</Context.Provider>
}
