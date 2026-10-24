// Platform integration (docs/specs/11-audio-engine.md §5, 24-browser-compatibility.md
// §3): audio session, Media Session and Screen Wake Lock, each feature-detected.

// Safari 16.4+: "playback" keeps practice audio playing with the iOS ringer switch on silent.
export function preferPlaybackAudioSession(): boolean {
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession
  if (!session) return false
  session.type = 'playback'
  return true
}

export interface MediaSessionHandlers {
  play(): void
  pause(): void
  seekTo(seconds: number): void
  seekBy(seconds: number): void
}

export interface MediaSessionState {
  playing: boolean
  position: number
  duration: number
  rate: number
}

const SEEK_STEP_SECONDS = 5

// Lock-screen and headset controls. Returns null where Media Session is missing.
export function bindMediaSession(
  metadata: { title: string; artist?: string },
  handlers: MediaSessionHandlers,
): { update(state: MediaSessionState): void; dispose(): void } | null {
  if (!('mediaSession' in navigator)) return null
  const session = navigator.mediaSession
  session.metadata = new MediaMetadata({ title: metadata.title, artist: metadata.artist ?? '' })
  const actions: [MediaSessionAction, MediaSessionActionHandler][] = [
    ['play', () => handlers.play()],
    ['pause', () => handlers.pause()],
    ['stop', () => handlers.pause()],
    ['seekto', (details) => details.seekTime !== undefined && handlers.seekTo(details.seekTime)],
    ['seekbackward', (details) => handlers.seekBy(-(details.seekOffset ?? SEEK_STEP_SECONDS))],
    ['seekforward', (details) => handlers.seekBy(details.seekOffset ?? SEEK_STEP_SECONDS)],
  ]
  const bound: MediaSessionAction[] = []
  for (const [action, handler] of actions) {
    // Browsers throw for actions they don't support; those simply stay unbound.
    try {
      session.setActionHandler(action, handler)
      bound.push(action)
    } catch {}
  }
  return {
    update(state) {
      session.playbackState = state.playing ? 'playing' : 'paused'
      if (state.duration > 0) {
        session.setPositionState?.({
          duration: state.duration,
          playbackRate: state.rate,
          position: Math.min(Math.max(0, state.position), state.duration),
        })
      }
    },
    dispose() {
      for (const action of bound) session.setActionHandler(action, null)
      session.metadata = null
      session.playbackState = 'none'
    },
  }
}

// Keeps the screen on while wanted, re-acquiring after the page becomes visible again (the
// browser drops the lock when the page is hidden).
export class ScreenWakeLock {
  #wanted = false
  #sentinel: WakeLockSentinel | null = null
  readonly #onVisibility = () => {
    if (document.visibilityState === 'visible' && this.#wanted) void this.#request()
  }

  static get supported(): boolean {
    return typeof navigator !== 'undefined' && 'wakeLock' in navigator
  }

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.#onVisibility)
    }
  }

  get held(): boolean {
    return this.#sentinel !== null && !this.#sentinel.released
  }

  // False when unsupported or refused (battery saver, hidden page); the app shows the
  // "Keep screen on" tip instead (24-browser-compatibility.md §3).
  async acquire(): Promise<boolean> {
    this.#wanted = true
    return this.#request()
  }

  async release(): Promise<void> {
    this.#wanted = false
    const sentinel = this.#sentinel
    this.#sentinel = null
    if (sentinel && !sentinel.released) await sentinel.release()
  }

  dispose(): void {
    void this.release()
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.#onVisibility)
    }
  }

  async #request(): Promise<boolean> {
    if (!ScreenWakeLock.supported) return false
    if (this.held) return true
    try {
      this.#sentinel = await navigator.wakeLock.request('screen')
      return true
    } catch {
      return false
    }
  }
}
