import { type ReactNode, useId } from 'react'

// A titled group of settings in the practice popovers (loop options, display): sections are set
// apart by a hairline, not a tile, so the controls inside keep their own wells (a segmented track
// on a sunken tile would vanish into it, 26 §4.5).
export function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  const id = useId()
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-3 border-t border-border pt-4 first-of-type:border-t-0 first-of-type:pt-0"
    >
      <h3 id={id} className="text-sm font-semibold text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  )
}
