import type { Meta, StoryObj } from '@storybook/react-vite'
import { BrandMark, Wordmark } from './brand.tsx'
import { CUSTOM_ICONS } from './icons/index.tsx'

const meta = { title: 'Brand/Marks and icons' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const Marks = () => (
  <div className="flex flex-col gap-8">
    <div className="flex flex-wrap items-center gap-8">
      <Wordmark />
      <Wordmark tone="mono" />
      <BrandMark className="size-16" />
    </div>
    <div className="flex flex-wrap items-end gap-6">
      {[
        ['App icon', '/icons/icon.svg'],
        ['Maskable', '/icons/icon-maskable.svg'],
        ['Mono', '/icons/icon-mono.svg'],
        ['Favicon', '/favicon.svg'],
      ].map(([label, src]) => (
        <figure key={src} className="m-0 flex flex-col items-center gap-2">
          <img src={src} alt="" className="size-24 rounded-xl border border-border bg-paper" />
          <figcaption className="text-sm text-muted-foreground">{label}</figcaption>
        </figure>
      ))}
      <figure className="m-0 flex flex-col items-center gap-2">
        <span className="flex items-end gap-2">
          <img src="/favicon.svg" alt="" className="size-8" />
          <img src="/favicon.svg" alt="" className="size-4" />
        </span>
        <figcaption className="text-sm text-muted-foreground">32 / 16</figcaption>
      </figure>
    </div>
  </div>
)

const Icons = () => (
  <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-4 p-0">
    {Object.entries(CUSTOM_ICONS).map(([name, Icon]) => (
      <li
        key={name}
        className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-4"
      >
        <span className="flex items-end gap-3">
          <Icon aria-hidden className="size-4" />
          <Icon aria-hidden className="size-5" />
          <Icon aria-hidden className="size-6" />
          <Icon aria-hidden className="size-8" />
        </span>
        <span className="text-sm">{name.replace(/Icon$/, '')}</span>
      </li>
    ))}
  </ul>
)

export const Wordmarks: Story = { render: Marks }
export const CustomIcons: Story = { render: Icons }
export const Dark: Story = { render: Marks, globals: { appearance: 'dark' } }
export const IconsStage: Story = { render: Icons, globals: { appearance: 'stage' } }
