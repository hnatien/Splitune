import { describe, expect, it } from 'vitest'
import { youtubeStill, youtubeVideoId } from './youtube'

describe('youtubeVideoId', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtube.com/watch?list=PL1&v=dQw4w9WgXcQ&t=42s', 'dQw4w9WgXcQ'],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://music.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?si=abc', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/live/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ])('reads the id from %s', (url, id) => {
    expect(youtubeVideoId(url)).toBe(id)
  })

  it.each([
    [null],
    [''],
    ['not a link'],
    ['https://vimeo.com/123456789'],
    ['https://www.youtube.com/watch?v=short'],
    ['https://www.youtube.com/playlist?list=PL1'],
    ['https://youtube.example.com/watch?v=dQw4w9WgXcQ'],
  ])('has no id for %s', (url) => {
    expect(youtubeVideoId(url)).toBeNull()
  })

  it('names the still on the image host the CSP allows', () => {
    expect(youtubeStill('dQw4w9WgXcQ')).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg')
  })
})
