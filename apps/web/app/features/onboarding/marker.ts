// The cheap check every page makes (13 §1): a localStorage marker says this browser holds a
// visitor's progress no account has claimed yet, without opening IndexedDB or loading guest code.
const PROGRESS_MARKER = 'splitune.guest'

export function markGuestProgress() {
  try {
    localStorage.setItem(PROGRESS_MARKER, '1')
  } catch {
    // Storage blocked: the progress is claimed from /start/saved only.
  }
}

export function hasGuestProgress(): boolean {
  try {
    return localStorage.getItem(PROGRESS_MARKER) === '1'
  } catch {
    return false
  }
}

export function clearGuestProgress() {
  try {
    localStorage.removeItem(PROGRESS_MARKER)
  } catch {
    // Nothing to clear.
  }
}
