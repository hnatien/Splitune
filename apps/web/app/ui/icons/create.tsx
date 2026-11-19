import { createLucideIcon, type IconNode, type LucideIcon, type LucideProps } from 'lucide-react'

/** The icon stroke (doc 26 §11): Lucide's 24 px grid at 1.8 px, round caps and joins. */
export const ICON_STROKE = 1.8

/** A Lucide-compatible custom icon that draws at ICON_STROKE unless a caller passes `strokeWidth`. */
export function createIcon(name: string, node: IconNode): LucideIcon {
  const Base = createLucideIcon(name, node)
  const Icon = ({ strokeWidth = ICON_STROKE, ...props }: LucideProps) => (
    <Base strokeWidth={strokeWidth} {...props} />
  )
  Icon.displayName = Base.displayName
  return Icon as LucideIcon
}
