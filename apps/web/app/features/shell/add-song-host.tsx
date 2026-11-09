import { useNavigate, useRouterState } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
import type { MeData } from '@/lib/session'
import type { AddTab } from '../import/add-song-state'

const AddSongDialog = lazy(() => import('../import/add-song-dialog'))

// `/library?add=file|link|record` opens Add song over the library (27 §1, §3.6). The dialog loads on
// first use; closing it drops `add` and leaves the rest of the library's URL as it was.
export function AddSongHost({ me }: { me: MeData }) {
  const navigate = useNavigate()
  const location = useRouterState({ select: (state) => state.location })
  const add =
    location.pathname === '/library' ? (location.search as { add?: AddTab }).add : undefined
  if (!add) return null
  const close = () => {
    const { add: _closed, ...rest } = location.search as Record<string, unknown>
    void navigate({ to: '/library', search: rest, replace: true })
  }
  return (
    <Suspense>
      <AddSongDialog me={me} tab={add} onClose={close} />
    </Suspense>
  )
}
