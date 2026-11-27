// A song added by link knows the page it came from. For a YouTube link that gives the video's own
// still, which the library shows as the song's tile (27 §3.5). The image host is allowed by the
// CSP (server/headers.ts).

const ID = /^[A-Za-z0-9_-]{11}$/
const HOSTS = new Set(['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com'])

/** The video id in a YouTube link (watch, youtu.be, shorts, live, embed), or null. */
export function youtubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  const host = parsed.hostname.replace(/^www\./, '')
  const [first, second] = parsed.pathname.split('/').filter(Boolean)
  const id =
    host === 'youtu.be'
      ? first
      : !HOSTS.has(host)
        ? undefined
        : first === 'watch'
          ? parsed.searchParams.get('v')
          : first === 'shorts' || first === 'live' || first === 'embed'
            ? second
            : undefined
  return id && ID.test(id) ? id : null
}

/** The video's still, 480 × 360: sharp in a tile on a dense screen. It is 4:3 with the 16:9 frame
 * letterboxed inside, so a 16:9 box that covers it shows the frame alone. */
export const youtubeStill = (videoId: string) => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`

/** YouTube answers a missing still with a 120 px wide grey placeholder instead of an error. */
export const isMissingStill = (image: HTMLImageElement) => image.naturalWidth <= 120
