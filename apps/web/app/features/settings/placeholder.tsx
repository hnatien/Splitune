import type * as React from 'react'

// A settings section whose content arrives with a later step.
export function SettingsPlaceholder({
  title,
  body,
  icon,
}: {
  title: string
  body: string
  icon: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl">{title}</h2>
      <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-5">
        <span className="text-muted-foreground [&_svg]:size-6">{icon}</span>
        <p className="text-base text-muted-foreground">{body}</p>
      </div>
    </section>
  )
}
