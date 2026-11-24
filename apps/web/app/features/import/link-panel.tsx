import { ClipboardPasteIcon } from 'lucide-react'
import { useId, useState } from 'react'
import { z } from 'zod'
import { m } from '@/lib/i18n'
import { Button } from '@/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/ui/field'
import { Input } from '@/ui/input'
import { Switch } from '@/ui/switch'

const HttpUrl = z.url({ protocol: /^https?$/ })

export type LinkRequest = { url: string; downloadVideo: boolean }

export const isImportableUrl = (url: string) => HttpUrl.safeParse(url.trim()).success

/** The link field's id prefix, so a submit with a bad link can move focus to the field. */
export const LINK_FIELD_ID = 'add-song-link'

// Link tab (27 §3.6, 25 §4): paste a video or song link; the Mac downloads it and analyses it.
// The link is checked when the field is left and when the learner submits (`checked`), and a bad
// one says what to enter under the field with an icon (WCAG 3.3.1); submit is never disabled in
// advance. "Also download the video" says what it costs.
export function LinkPanel({
  value,
  onChange,
  checked = false,
}: {
  value: LinkRequest
  onChange: (value: LinkRequest) => void
  /** The learner tried to submit: an empty or bad link shows its error now. */
  checked?: boolean
}) {
  const [touched, setTouched] = useState(false)
  const id = useId()
  const url = value.url.trim()
  const invalid =
    (touched && url !== '' && !isImportableUrl(url)) || (checked && !isImportableUrl(url))
  const canPaste =
    typeof navigator !== 'undefined' && typeof navigator.clipboard?.readText === 'function'
  return (
    <div className="flex flex-col gap-5">
      <Field data-invalid={invalid || undefined}>
        <FieldLabel htmlFor={LINK_FIELD_ID}>{m['import.url_label']()}</FieldLabel>
        <div className="flex gap-2">
          <Input
            id={LINK_FIELD_ID}
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder={m['import.url_placeholder']()}
            value={value.url}
            aria-invalid={invalid || undefined}
            aria-describedby={`${id}-hint${invalid ? ` ${id}-error` : ''}`}
            onBlur={() => setTouched(true)}
            onChange={(event) => onChange({ ...value, url: event.target.value })}
            className="min-w-0 flex-1"
          />
          {canPaste && (
            <Button
              onClick={async () => {
                const text = await navigator.clipboard.readText().catch(() => '')
                if (text) onChange({ ...value, url: text.trim() })
              }}
            >
              <ClipboardPasteIcon aria-hidden />
              {m['import.paste']()}
            </Button>
          )}
        </div>
        {invalid && <FieldError id={`${id}-error`}>{m['import.url_invalid']()}</FieldError>}
        <FieldDescription id={`${id}-hint`}>{m['import.sites_hint']()}</FieldDescription>
      </Field>
      <div className="flex min-h-target items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <label htmlFor={`${id}-video`} className="text-label">
            {m['import.download_video']()}
          </label>
          <span id={`${id}-video-hint`} className="text-body-sm text-muted-foreground">
            {m['import.download_video_hint']()}
          </span>
        </div>
        <Switch
          id={`${id}-video`}
          aria-describedby={`${id}-video-hint`}
          checked={value.downloadVideo}
          onCheckedChange={(on) => onChange({ ...value, downloadVideo: on })}
        />
      </div>
    </div>
  )
}
