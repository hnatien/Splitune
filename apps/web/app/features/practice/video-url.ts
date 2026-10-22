import { useQuery } from '@tanstack/react-query'
import { orpc } from '@/lib/api'
import { usePractice } from './practice-context'

/** The URL import's downloaded video, if it has one (13 §6a); signed for 15 minutes. */
export function useVideoUrl() {
  const { data, songId } = usePractice()
  // url_import ends "done" with the video, or as a video_unavailable fallback without it.
  const downloaded =
    data.song.data?.source_kind === 'url' &&
    data.analysis.data?.stages['url_import']?.status === 'done'
  return useQuery({
    ...orpc.songs.mediaUrl.queryOptions({ input: { id: songId, kind: 'video' } }),
    enabled: downloaded,
    retry: false,
    // Signed for 15 minutes; refreshed before it lapses.
    staleTime: 10 * 60_000,
    refetchInterval: 10 * 60_000,
  })
}
