import { useEffect, useState } from 'react'

/**
 * Which of the page's sections (by element id) is being read: the first one crossing a band a
 * fifth of the way down the viewport, or the last one once the page is scrolled to its foot (the
 * last sections may never reach the band). It keeps the last answer while the band sits between
 * two sections, and stays undefined where IntersectionObserver is missing (the links still work).
 */
export function useCurrentSection(ids: readonly string[]): string | undefined {
  const [current, setCurrent] = useState<string | undefined>()
  const key = ids.join(' ')
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const elements = key
      .split(' ')
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null)
    const crossing = new Set<string>()
    const update = () => {
      const root = document.documentElement
      const atFoot =
        window.scrollY > 0 && window.innerHeight + window.scrollY >= root.scrollHeight - 2
      const found = atFoot ? elements.at(-1) : elements.find((element) => crossing.has(element.id))
      if (found) setCurrent(found.id)
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) crossing.add(entry.target.id)
          else crossing.delete(entry.target.id)
        }
        update()
      },
      { rootMargin: '-20% 0px -70% 0px' },
    )
    for (const element of elements) observer.observe(element)
    window.addEventListener('scroll', update, { passive: true })
    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', update)
    }
  }, [key])
  return current
}
