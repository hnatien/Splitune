import { type ReactNode, useId } from 'react'

// A titled group of settings on a sunken tile, for the practice popovers (loop options, display).
export function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 rounded-xl bg-surface-sunken p-3">
      <h3 id={id} className="text-sm font-semibold">
        {title}
      </h3>
      {children}
    </section>
  )
}
