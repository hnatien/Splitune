import { describe, expect, it } from 'vitest'
import { examplePractice, tabLevelFor } from './defaults'
import { type ExampleSong, exampleFor } from './examples'

const example = {
  instrument: 'guitar',
  loop: { start_bar: 4, end_bar: 7 },
  speed_pct: { just_started: 70, few_songs: 80, returning: 80 },
} as ExampleSong

describe('onboarding defaults', () => {
  it('loops the suggested bars (1-based) with the part loud at the level’s speed', () => {
    expect(examplePractice(example, 'guitar', 'just_started')).toEqual({
      loop: '5-8',
      speed: 70,
      mix: 'your-part',
      level: 'simplified',
    })
    expect(examplePractice(example, 'guitar', 'few_songs')).toMatchObject({
      speed: 80,
      level: 'as_transcribed',
    })
    // Skipped questions count as "just started".
    expect(examplePractice(example, null, null)).toMatchObject({ speed: 70 })
  })

  it('simplifies by instrument: bass roots for beginners, chords for other instruments', () => {
    expect(tabLevelFor('bass', 'bass', 'just_started')).toBe('roots')
    expect(tabLevelFor('bass', 'bass', 'returning')).toBe('full')
    expect(tabLevelFor('other', 'guitar', 'few_songs')).toBe('chords_only')
    expect(tabLevelFor('piano', 'guitar', null)).toBe('chords_only')
  })
})

describe('exampleFor', () => {
  const song = (id: string, instrument: string, part: string) =>
    ({ id, instrument, part }) as ExampleSong
  const examples = [
    song('riff', 'guitar', 'riff'),
    song('rhythm', 'guitar', 'rhythm'),
    song('bass', 'bass', 'bass_line'),
  ]

  it('gives beginners chords and others the riff, on their own instrument', () => {
    expect(exampleFor(examples, 'guitar', 'just_started')?.id).toBe('rhythm')
    expect(exampleFor(examples, 'guitar', 'few_songs')?.id).toBe('riff')
    expect(exampleFor(examples, 'bass', 'just_started')?.id).toBe('bass')
    expect(exampleFor(examples, 'other', null)?.id).toBe('riff')
    expect(exampleFor([], 'guitar', null)).toBeUndefined()
  })
})
