// Feature flags (16 §5; personal mode: rows in feature_flags). Every flag the code evaluates is
// declared here with the value used while no row exists, so a missing or deleted row never turns
// a feature on by accident. Kill switches default on; v1 features default off until they ship.
// Plan limits (`plan.*`) are value flags read by the API's entitlements, not listed here.
export const FLAGS = {
  'import.url': { default: true, description: 'Link import through yt-dlp on the Mac' },
  examples: { default: true, description: 'Example songs in onboarding and the library' },
  'v1.speed_trainer': { default: false, description: 'Speed trainer settings on saved clips' },
  'v1.mic_scoring': { default: false, description: 'Microphone pass scoring' },
  'v1.midi_wait_mode': { default: false, description: 'MIDI wait mode for piano' },
  'v1.export': { default: false, description: 'Export of tab and clips' },
  'v1.drums': { default: false, description: 'Drum transcription and the drum views' },
} as const satisfies Record<string, { default: boolean; description: string }>

export type FlagKey = keyof typeof FLAGS

export const FLAG_KEYS = Object.keys(FLAGS) as FlagKey[]
