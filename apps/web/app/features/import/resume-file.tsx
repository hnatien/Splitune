import { FileAudioIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { m } from '@/lib/i18n'
import { Button } from '@/ui/button'
import { InlineError } from '@/ui/status-message'
import { DifferentFileError, resumeWithFile } from './upload-manager'

// After a reload in a browser that couldn't keep the picked file (Safari private browsing): pick
// the same file again and the upload continues with the parts that are still missing.
export function ResumeFilePrompt({ songId, title }: { songId: string; title: string }) {
  const input = useRef<HTMLInputElement>(null)
  const [checking, setChecking] = useState(false)
  const [wrongFile, setWrongFile] = useState(false)
  return (
    <InlineError
      tone="info"
      className="flex-1"
      title={m['upload.choose_again']({ title })}
      description={wrongFile ? m['upload.wrong_file']() : undefined}
      actions={
        <>
          <Button variant="primary" loading={checking} onClick={() => input.current?.click()}>
            <FileAudioIcon aria-hidden />
            {m['upload.choose_file']()}
          </Button>
          <input
            ref={input}
            type="file"
            hidden
            onChange={async (event) => {
              const file = event.currentTarget.files?.[0]
              event.currentTarget.value = ''
              if (!file) return
              setChecking(true)
              setWrongFile(false)
              try {
                await resumeWithFile(songId, file)
              } catch (error) {
                if (!(error instanceof DifferentFileError)) throw error
                setWrongFile(true)
              } finally {
                setChecking(false)
              }
            }}
          />
        </>
      }
    />
  )
}
