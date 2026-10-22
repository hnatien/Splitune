import type { QueryClient } from '@tanstack/react-query'
import { examplesQuery, practiseAsGuest } from './examples'

/**
 * Whether a signed-out visitor may open this song's practice screen: an example song, practised
 * on the device (13 §1). Loaded by the practice route only for visitors.
 */
export async function enterAsGuest(queryClient: QueryClient, songId: string): Promise<boolean> {
  const { items } = await queryClient.ensureQueryData(examplesQuery)
  if (!items.some((example) => example.song.id === songId)) return false
  practiseAsGuest(items)
  return true
}
