import type { ScoreTheme } from '@splitune/notation'
import { readColor, type TokenName } from '@splitune/ui-tokens'
import { useEffect, useState } from 'react'

// The score's fonts and colours from the tokens in effect where the score is drawn (12 §3,
// 26 §2/§6.3): re-read when the appearance, contrast, distance, reading font or calibration
// changes. Sizes come from a probe element, because the reading tokens are calc() expressions.

function readTheme(element: HTMLElement): ScoreTheme {
  const token = (name: TokenName) => readColor(name, element)
  const probe = document.createElement('span')
  probe.style.position = 'absolute'
  probe.style.visibility = 'hidden'
  element.append(probe)
  const px = (token: string) => {
    probe.style.fontSize = `var(${token})`
    return Number.parseFloat(getComputedStyle(probe).fontSize) || 16
  }
  probe.style.fontFamily = 'var(--font-reading)'
  const family = getComputedStyle(probe).fontFamily
  // At least 18 px fret digits even at Desk (26 §6.3).
  const theme: ScoreTheme = {
    family,
    tabPx: Math.max(18, px('--read-tab')),
    barNumberPx: px('--read-bar-number'),
    ink: { high: token('--ink'), medium: token('--conf-medium'), low: token('--conf-low') },
    staff: token('--staff'),
  }
  probe.remove()
  return theme
}

export function useScoreTheme(element: HTMLElement | null): ScoreTheme | undefined {
  return useTokens(element, readTheme)
}

/** Values read from the tokens in effect at `element`, re-read whenever they may have changed. */
export function useTokens<T>(element: HTMLElement | null, read: (element: HTMLElement) => T) {
  const [theme, setTheme] = useState<T | undefined>(undefined)
  useEffect(() => {
    if (!element) return
    const apply = () =>
      setTheme((previous) => {
        const next = read(element)
        return previous && JSON.stringify(previous) === JSON.stringify(next) ? previous : next
      })
    apply()
    const observer = new MutationObserver(apply)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [
        'data-appearance',
        'data-contrast',
        'data-distance',
        'data-reading-font',
        'data-score',
        'style',
      ],
    })
    void document.fonts?.ready.then(apply)
    return () => observer.disconnect()
  }, [element, read])
  return theme
}
