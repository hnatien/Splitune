import bravuraLicence from '@coderline/alphatab/font/Bravura-OFL.txt?url'
import { ExternalLinkIcon } from 'lucide-react'
import { formatDate } from '@/lib/format'
import { m } from '@/lib/i18n'
import { Card } from '@/ui/card'
import { SectionRule, SettingSection, SettingsPage } from './setting-row'

// Settings → About (27 §3.9; no mockup): the version and build date, the transcription models and
// their versions, the font licences with their texts, the provenance register and the personal-mode
// line. Build facts come from `buildDefines()` in vite.base.ts.

declare const __SPLITUNE_BUILD__: {
  commit: string | null
  builtAt: string
  models: { name: string; version: string }[]
}

// Font names are names, not copy; every font is SIL OFL 1.1 and its text ships with the app.
const FONTS = [
  { name: 'Instrument Sans', licence: '/fonts/InstrumentSans-OFL.txt' },
  { name: 'JetBrains Mono', licence: '/fonts/JetBrainsMono-OFL.txt' },
  { name: 'Bravura', licence: bravuraLicence },
  { name: 'Atkinson Hyperlegible Next', licence: '/fonts/AtkinsonHyperlegibleNext-OFL.txt' },
] as const

const REGISTER_URL = 'https://github.com/hnatien/Splitune/tree/dev/compliance/register'

const LINK =
  'inline-flex min-h-target items-center text-primary-ink underline underline-offset-4 hover:decoration-2'

export function AboutSettings() {
  const build = __SPLITUNE_BUILD__
  const date = formatDate(new Date(build.builtAt))
  return (
    <SettingsPage title={m['settings.about']()}>
      <p className="text-base">
        {build.commit
          ? m['settings.about_version']({ commit: build.commit, date })
          : m['settings.about_built']({ date })}
      </p>
      <SettingSection id="models" title={m['settings.about_models']()}>
        <Card className="gap-0 px-4 py-1">
          <ul className="flex list-none flex-col p-0">
            {build.models.map((model) => (
              <li
                key={model.name}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-border py-2.5 last:border-b-0"
              >
                <span className="min-w-0 text-base">{model.name}</span>
                <span className="font-mono text-sm break-all text-muted-foreground">
                  {model.version}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </SettingSection>
      <SectionRule />
      <SettingSection id="fonts" title={m['settings.about_fonts']()}>
        <ul className="flex list-none flex-col gap-2 p-0">
          {FONTS.map((font) => (
            <li key={font.name} className="flex flex-wrap items-baseline gap-x-3 text-base">
              <span className="font-semibold">{font.name}</span>
              <a href={font.licence} target="_blank" rel="noreferrer" className={LINK}>
                {m['settings.about_ofl']()}
              </a>
            </li>
          ))}
        </ul>
      </SettingSection>
      <SectionRule />
      <SettingSection id="register" title={m['settings.about_register']()}>
        <a
          href={REGISTER_URL}
          target="_blank"
          rel="noreferrer"
          className={`${LINK} inline-flex min-h-target items-center gap-1.5 self-start text-base`}
        >
          {m['settings.about_register_link']()}
          <ExternalLinkIcon aria-hidden strokeWidth={1.8} className="size-4" />
        </a>
      </SettingSection>
      <SectionRule />
      <p className="text-sm text-muted-foreground">{m['settings.about_personal']()}</p>
    </SettingsPage>
  )
}
