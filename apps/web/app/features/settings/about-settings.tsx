import bravuraLicence from '@coderline/alphatab/font/Bravura-OFL.txt?url'
import { ChevronRightIcon, ExternalLinkIcon } from 'lucide-react'
import { formatDate } from '@/lib/format'
import { m } from '@/lib/i18n'
import { ListGroup, ListRow } from '@/ui/list-row'
import { SettingSection, SettingsPage } from './setting-row'

// Settings → About (27 §3.9; no mockup): the version and build date, the font licences with their
// texts, the provenance register, the personal-mode line, and the transcription models folded away
// (developer provenance, not learner information: one line says how many, opening it lists each
// with its version cut to one line, the full id on hover). Build facts come from `buildDefines()`
// in vite.base.ts.

declare const __SPLITUNE_BUILD__: {
  commit: string | null
  builtAt: string
  models: { name: string; version: string }[]
}

// Font names are names, not copy; every font is SIL OFL 1.1 and its text ships with the app.
const FONTS = [
  { name: 'Figtree', licence: '/fonts/Figtree-OFL.txt' },
  { name: 'JetBrains Mono', licence: '/fonts/JetBrainsMono-OFL.txt' },
  { name: 'Bravura', licence: bravuraLicence },
  { name: 'Atkinson Hyperlegible Next', licence: '/fonts/AtkinsonHyperlegibleNext-OFL.txt' },
] as const

const REGISTER_URL = 'https://github.com/hnatien/Splitune/tree/dev/compliance/register'

const LINK =
  'inline-flex min-h-target items-center gap-1.5 text-label text-foreground underline underline-offset-4 hover:decoration-2'

export function AboutSettings() {
  const build = __SPLITUNE_BUILD__
  const date = formatDate(new Date(build.builtAt))
  return (
    <SettingsPage
      title={m['settings.about']()}
      intro={
        build.commit
          ? m['settings.about_version']({ commit: build.commit, date })
          : m['settings.about_built']({ date })
      }
    >
      <SettingSection id="fonts" title={m['settings.about_fonts']()}>
        <ListGroup>
          {FONTS.map((font) => (
            <ListRow
              key={font.name}
              title={font.name}
              aside={
                <a href={font.licence} target="_blank" rel="noreferrer" className={LINK}>
                  {m['settings.about_ofl']()}
                </a>
              }
            />
          ))}
        </ListGroup>
      </SettingSection>
      <SettingSection id="register" title={m['settings.about_register']()}>
        <a href={REGISTER_URL} target="_blank" rel="noreferrer" className={`${LINK} self-start`}>
          {m['settings.about_register_link']()}
          <ExternalLinkIcon aria-hidden strokeWidth={1.8} className="size-4" />
        </a>
      </SettingSection>
      <SettingSection id="models" title={m['settings.about_models']()}>
        <details className="group/models">
          <summary className="flex min-h-target cursor-pointer list-none items-center gap-2 rounded-field text-label text-foreground [&::-webkit-details-marker]:hidden">
            <ChevronRightIcon
              aria-hidden
              strokeWidth={1.8}
              className="size-4 shrink-0 text-muted-foreground transition-transform duration-(--duration-fast) group-open/models:rotate-90"
            />
            {m['settings.about_models_show']({ count: String(build.models.length) })}
          </summary>
          <ListGroup>
            {build.models.map((model) => (
              <ListRow
                key={model.name}
                title={model.name}
                meta={
                  <span className="font-mono" title={model.version}>
                    {model.version}
                  </span>
                }
              />
            ))}
          </ListGroup>
        </details>
      </SettingSection>
      <p className="text-body-sm text-muted-foreground">{m['settings.about_personal']()}</p>
    </SettingsPage>
  )
}
