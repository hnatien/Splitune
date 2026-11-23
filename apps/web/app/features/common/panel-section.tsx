import { type ReactNode, useId } from 'react'

// A titled group of settings in the practice popovers (display): sections are set apart by a
// hairline, not a tile, with the same quiet head as the panel's sections (26 §12.2), and named by
// it for assistive technology.
export function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  const id = useId()
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-3 border-t border-border pt-4 first-of-type:border-t-0 first-of-type:pt-0"
    >
      <h3 id={id} className="text-label-sm text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  )
}
