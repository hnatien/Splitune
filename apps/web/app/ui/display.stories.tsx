import type { Meta, StoryObj } from '@storybook/react-vite'
import { CircleCheckIcon, TriangleAlertIcon } from 'lucide-react'
import { expect, userEvent, within } from 'storybook/test'
import { Badge } from './badge.tsx'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './card.tsx'
import { Kbd, KbdGroup } from './kbd.tsx'
import { Meter, MeterLabel, MeterValue } from './meter.tsx'
import { Progress, ProgressLabel, ProgressValue } from './progress.tsx'
import { ScrollArea } from './scroll-area.tsx'
import { Separator } from './separator.tsx'
import { Skeleton } from './skeleton.tsx'
import { Spinner } from './spinner.tsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs.tsx'

const BARS = Array.from({ length: 40 }, (_, index) => index + 1)

const meta = { title: 'Base/Display' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const SettingsTabs = () => (
  <Tabs defaultValue="display">
    <TabsList>
      <TabsTrigger value="profile">Profile</TabsTrigger>
      <TabsTrigger value="display">Display &amp; practice</TabsTrigger>
      <TabsTrigger value="keys">Keyboard &amp; pedal</TabsTrigger>
      <TabsTrigger value="plan" disabled>
        Plan &amp; billing
      </TabsTrigger>
    </TabsList>
    <TabsContent value="profile">Profile settings.</TabsContent>
    <TabsContent value="display">Appearance, reading size and font.</TabsContent>
    <TabsContent value="keys">Shortcuts and pedal mapping.</TabsContent>
  </Tabs>
)

export const TabsDefault: Story = { render: SettingsTabs }
export const TabsKeyboard: Story = {
  render: SettingsTabs,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    canvas.getByRole('tab', { name: 'Display & practice' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    await expect(canvas.getByRole('tab', { name: 'Keyboard & pedal' })).toHaveFocus()
  },
}

const BadgesDemo = () => (
  <div className="flex flex-wrap gap-2">
    <Badge variant="success">
      <CircleCheckIcon aria-hidden />
      Ready
    </Badge>
    <Badge variant="warning">
      <TriangleAlertIcon aria-hidden />
      Rough tab
    </Badge>
    <Badge>Chords only</Badge>
    <Badge variant="info">Analysing</Badge>
    <Badge variant="destructive">Failed</Badge>
    <Badge variant="primary">Your part</Badge>
    <Badge variant="outline">Lite</Badge>
  </div>
)
export const Badges: Story = { render: BadgesDemo }

const ProgressesDemo = () => (
  <div className="flex max-w-md flex-col gap-6">
    <Progress value={42}>
      <ProgressLabel>Uploading</ProgressLabel>
      <ProgressValue />
    </Progress>
    <Meter value={4} min={0} max={5} getAriaValueText={() => '4 of 5 Lite analyses left'}>
      <MeterLabel>Lite analyses</MeterLabel>
      <MeterValue>{() => '4 of 5'}</MeterValue>
    </Meter>
  </div>
)
export const Progresses: Story = { render: ProgressesDemo }

export const Loading: Story = {
  render: () => (
    <div className="flex max-w-md flex-col gap-3" aria-busy="true">
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner />
        Loading your song…
      </span>
    </div>
  ),
}

const CardsDemo = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle>Plus</CardTitle>
      <CardDescription>Full analyses with your part isolated, plus tab.</CardDescription>
    </CardHeader>
    <CardContent>
      <p>
        Press <Kbd>Space</Kbd> to play,{' '}
        <KbdGroup>
          <Kbd>⇧</Kbd>
          <Kbd>←</Kbd>
        </KbdGroup>{' '}
        to move the loop.
      </p>
    </CardContent>
    <Separator />
    <CardFooter>Demo mode — no real charges.</CardFooter>
  </Card>
)
export const Cards: Story = { render: CardsDemo }

export const Scrolling: Story = {
  render: () => (
    <ScrollArea
      className="h-48 w-72 rounded-lg border border-border"
      tabIndex={0}
      aria-label="Bars"
    >
      <ol className="p-4">
        {BARS.map((bar) => (
          <li key={bar} className="py-1 tabular-nums">
            Bar {bar}
          </li>
        ))}
      </ol>
    </ScrollArea>
  ),
}

const Gallery = () => (
  <div className="flex flex-col gap-8">
    <SettingsTabs />
    <BadgesDemo />
    <ProgressesDemo />
    <CardsDemo />
  </div>
)
export const Dark: Story = { render: Gallery, globals: { appearance: 'dark' } }
export const Stage: Story = { render: Gallery, globals: { appearance: 'stage' } }
export const IncreasedContrast: Story = { render: Gallery, globals: { contrast: 'more' } }
