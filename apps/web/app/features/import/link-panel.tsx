import { ClipboardPasteIcon } from 'lucide-react'
import { useId, useState } from 'react'
import { z } from 'zod'
import { m } from '@/lib/i18n'
import { Button } from '@/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/ui/field'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { Switch } from '@/ui/switch'

const HttpUrl = z.url({ protocol: /^https?$/ })

export type LinkRequest = { url: string; downloadVideo: boolean }

// Link tab (27 §3.6, 25 §4): paste a video or song link; the Mac downloads it and analyses it.
export function LinkPanel({
  value,
  onChange,
}: {
  value: LinkRequest
  onChange: (value: LinkRequest) => void
}) {
  const [touched, setTouched] = useState(false)
  const id = useId()
  const invalid = touched && value.url.trim() !== '' && !HttpUrl.safeParse(value.url.trim()).success
  const canPaste =
    typeof navigator !== 'undefined' && typeof navigator.clipboard?.readText === 'function'
  return (
    <div className="flex flex-col gap-5">
      <Field data-invalid={invalid || undefined}>
        <FieldLabel htmlFor={`${id}-url`}>{m['import.url_label']()}</FieldLabel>
        <div className="flex gap-2">
          <Input
            id={`${id}-url`}
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder={m['import.url_placeholder']()}
            value={value.url}
            aria-invalid={invalid || undefined}
            aria-describedby={`${id}-hint${invalid ? ` ${id}-error` : ''}`}
            onBlur={() => setTouched(true)}
            onChange={(event) => onChange({ ...value, url: event.target.value })}
          />
          {canPaste && (
            <Button
              variant="outline"
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
        <FieldDescription id={`${id}-hint`}>{m['import.sites_hint']()}</FieldDescription>
        {invalid && <FieldError id={`${id}-error`}>{m['import.url_invalid']()}</FieldError>}
      </Field>
      <div className="flex items-center gap-3">
        <Switch
          id={`${id}-video`}
          checked={value.downloadVideo}
          onCheckedChange={(checked) => onChange({ ...value, downloadVideo: checked })}
        />
        <Label htmlFor={`${id}-video`}>{m['import.download_video']()}</Label>
      </div>
    </div>
  )
}

export const isImportableUrl = (url: string) => HttpUrl.safeParse(url.trim()).success
