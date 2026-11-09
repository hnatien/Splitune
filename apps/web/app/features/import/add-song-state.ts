import { useNavigate, useRouterState } from '@tanstack/react-router'
import { create } from 'zustand'

// Add song opens over the library from `/library?add=file|link|record` (27 §1 route map): the
// button in the bar, ⌘K, `/import` and a file dropped anywhere in the app shell all lead there. A
// dropped file can't travel in the URL, so it waits here until the dialog takes it.

export type AddTab = 'file' | 'link' | 'record'

const TAB_KEY = 'splitune.import.tab'

/** The tab used last (27 §3.6), File when nothing is remembered. */
export function storedTab(): AddTab {
  try {
    const value = localStorage.getItem(TAB_KEY)
    return value === 'link' || value === 'record' ? value : 'file'
  } catch {
    return 'file'
  }
}

export function rememberTab(tab: AddTab) {
  try {
    localStorage.setItem(TAB_KEY, tab)
  } catch {
    // Remembering the tab is a convenience only.
  }
}

export const usePendingFile = create<{ file: File | undefined }>()(() => ({ file: undefined }))

/** Opens Add song over the library, on `tab` (the remembered one by default) or with `file`. */
export function useOpenAddSong() {
  const navigate = useNavigate()
  const location = useRouterState({ select: (state) => state.location })
  return (tab?: AddTab, file?: File) => {
    if (file) usePendingFile.setState({ file })
    const add = file ? 'file' : (tab ?? storedTab())
    const kept = location.pathname === '/library' ? (location.search as object) : {}
    void navigate({ to: '/library', search: { ...kept, add } })
  }
}
