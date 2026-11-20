import { Link } from '@tanstack/react-router'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/ui/button'

// Home (27 §3.1): the promise and the way to the example song, what it does, what makes it work at
// the stand, how a session goes and the pricing teaser. The headline is the LCP element (budget
// ≤ 2.5 s, 10 §9), so it is plain text that never animates in. The pictures are colour art
// (public/art/, prompts in docs/home-art.md): the one place colour lives outside meaning, each piece set beside the words
// that carry its point, so every image is decorative and has no text alternative.
// Honesty gates (27 §3.1): claims of unbuilt steps keep today's wording until s45 flips them — the
// isolate body (s40b), the loop body (s37), the count-in body (s42) — and "Stand view for tablets"
// (s43) is left out of the stand list until then.

const SECTION = 'mx-auto w-full max-w-marketing px-4 sm:px-6 lg:px-8'

type ArtName =
  | 'home-isolate'
  | 'home-loop'
  | 'home-honest'
  | 'home-pedal'
  | 'home-read'
  | 'home-beat'
  | 'home-offline'
  | 'home-progress'

function Art({
  name,
  width,
  height,
  className,
}: {
  name: ArtName
  width: number
  height: number
  className?: string
}) {
  return (
    <img
      src={`/art/${name}.webp`}
      alt=""
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      className={cn('rounded-md bg-muted object-cover', className)}
    />
  )
}

function Tile({ art, title, body }: { art: ArtName; title: string; body: string }) {
  return (
    <article className="flex flex-1 flex-col gap-4">
      <Art name={art} width={768} height={768} className="aspect-4/3 w-full sm:aspect-square" />
      <div className="flex flex-col gap-1.5">
        <h2 className="text-lg text-balance">{title}</h2>
        <p className="text-base text-pretty text-muted-foreground">{body}</p>
      </div>
    </article>
  )
}

const STAND: { art: ArtName; title: () => string; body: () => string }[] = [
  {
    art: 'home-pedal',
    title: () => m['home.stand_pedal_title'](),
    body: () => m['home.stand_pedal_body'](),
  },
  {
    art: 'home-read',
    title: () => m['home.stand_read_title'](),
    body: () => m['home.stand_read_body'](),
  },
  {
    art: 'home-beat',
    title: () => m['home.stand_beat_title'](),
    body: () => m['home.stand_beat_body'](),
  },
  {
    art: 'home-offline',
    title: () => m['home.stand_offline_title'](),
    body: () => m['home.stand_offline_body'](),
  },
  {
    art: 'home-progress',
    title: () => m['home.stand_progress_title'](),
    body: () => m['home.stand_progress_body'](),
  },
]

/** The headline's sentences, so each can hold its own line. */
const sentences = (text: string) => text.match(/[^.!?]+[.!?]+/g)?.map((s) => s.trim()) ?? [text]

export function Home() {
  const steps = [
    { title: m['home.step_1_title'](), body: m['home.step_1']() },
    { title: m['home.step_2_title'](), body: m['home.step_2']() },
    { title: m['home.step_3_title'](), body: m['home.step_3']() },
    { title: m['home.step_4_title'](), body: m['home.step_4']() },
  ]
  return (
    <div className="flex flex-col gap-24 pb-24 sm:gap-30">
      <section
        aria-labelledby="home-title"
        className={cn(SECTION, 'flex flex-col items-center gap-6 pt-16 text-center sm:pt-28')}
      >
        <h1 id="home-title" className="text-display">
          {sentences(m['home.headline']()).map((sentence) => (
            <span key={sentence} className="block text-balance">
              {sentence}{' '}
            </span>
          ))}
        </h1>
        <p className="max-w-[58ch] text-lead text-pretty text-muted-foreground">
          {m['home.subhead']()}
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link to="/start" className={buttonVariants({ variant: 'primary', size: 'lg' })}>
            {m['home.cta_example']()}
          </Link>
          <Link to="/auth/sign-in" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
            {m['nav.sign_in']()}
          </Link>
        </div>
        <div className="flex flex-col gap-1 text-sm">
          <p className="text-muted-foreground">{m['home.badge']()}</p>
          <p className="text-faint-foreground">{m['home.note']()}</p>
        </div>
      </section>

      <section
        aria-label={m['home.does_label']()}
        className={cn(SECTION, 'grid gap-x-8 gap-y-12 lg:grid-cols-4')}
      >
        <article className="flex flex-col gap-6 lg:sticky lg:top-24 lg:col-span-3 lg:self-start">
          <Art name="home-isolate" width={1984} height={1116} className="aspect-video w-full" />
          <div className="flex max-w-[44ch] flex-col gap-2.5">
            <h2 className="text-2xl text-balance">{m['home.proof_isolate_title']()}</h2>
            <p className="text-lead text-pretty text-muted-foreground">
              {m['home.proof_isolate_body']()}
            </p>
          </div>
        </article>
        <div className="flex flex-col gap-10 sm:flex-row sm:gap-8 lg:flex-col lg:gap-12">
          <Tile
            art="home-loop"
            title={m['home.proof_loop_title']()}
            body={m['home.proof_loop_body']()}
          />
          <Tile
            art="home-honest"
            title={m['home.proof_honest_title']()}
            body={m['home.proof_honest_body']()}
          />
        </div>
      </section>

      <section aria-labelledby="stand" className={cn(SECTION, 'flex flex-col gap-8')}>
        <h2 id="stand" className="text-xl">
          {m['home.stand_title']()}
        </h2>
        <ul className="grid gap-x-8 gap-y-7 md:grid-cols-2">
          {STAND.map(({ art, title, body }) => (
            <li key={title()} className="flex items-center gap-5">
              <Art name={art} width={512} height={512} className="size-24 shrink-0 sm:size-29" />
              <div className="flex flex-col gap-1">
                <h3 className="text-lg text-balance">{title()}</h3>
                <p className="text-base text-pretty text-muted-foreground">{body()}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="session" className={cn(SECTION, 'flex flex-col gap-8')}>
        <h2 id="session" className="text-xl">
          {m['home.session_title']()}
        </h2>
        <ol className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <li key={step.title} className="flex flex-col gap-2 border-t border-border pt-5">
              <span aria-hidden className="text-sm text-faint-foreground tabular-nums">
                {i + 1}
              </span>
              <h3 className="text-lg text-balance">{step.title}</h3>
              <p className="text-base text-pretty text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="free" className={SECTION}>
        <div className="flex flex-col items-center gap-5 rounded-xl bg-muted px-6 py-16 text-center sm:py-24">
          <h2 id="free" className="max-w-[18ch] text-2xl text-balance sm:text-3xl">
            {m['home.pricing_title']()}
          </h2>
          <p className="max-w-[48ch] text-lead text-pretty text-muted-foreground">
            {m['home.pricing_body']()}
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link to="/start" className={buttonVariants({ variant: 'primary', size: 'lg' })}>
              {m['home.cta_example']()}
            </Link>
            <Link to="/pricing" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
              {m['home.pricing_link']()}
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
