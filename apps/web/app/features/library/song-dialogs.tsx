import type { LibrarySong } from '@splitune/contracts'
import { useMutation } from '@tanstack/react-query'
import { useEffect, useId, useState } from 'react'
import type { z } from 'zod'
import { client, errorCode } from '@/lib/api'
import { m } from '@/lib/i18n'
import { apiErrorMessage } from '@/lib/reasons'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/ui/alert-dialog'
import { Button } from '@/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog'
import { Field, FieldError, FieldLabel } from '@/ui/field'
import { Input } from '@/ui/input'
import { InlineError } from '@/ui/status-message'
import { toast } from '@/ui/toast'

type Song = Pick<z.infer<typeof LibrarySong>, 'id' | 'title'>

type DialogProps = { song: Song; open: boolean; onOpenChange: (open: boolean) => void }

export function RenameSongDialog({
  song,
  open,
  onOpenChange,
  onRenamed,
}: DialogProps & { onRenamed: () => void }) {
  const [title, setTitle] = useState(song.title)
  const [empty, setEmpty] = useState(false)
  const errorId = useId()
  useEffect(() => {
    if (open) setTitle(song.title)
  }, [open, song.title])
  const rename = useMutation({
    mutationFn: (value: string) => client.songs.update({ id: song.id, title: value }),
    onSuccess: () => {
      onOpenChange(false)
      onRenamed()
      toast.add({ title: m['library.renamed'](), type: 'success' })
    },
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={m['system.close']()}>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            const value = title.trim()
            if (!value) {
              setEmpty(true)
              return
            }
            rename.mutate(value.slice(0, 200))
          }}
        >
          <DialogHeader>
            <DialogTitle>{m['library.rename_title']()}</DialogTitle>
          </DialogHeader>
          <Field data-invalid={empty || undefined}>
            <FieldLabel htmlFor={`${errorId}-title`}>{m['library.rename_label']()}</FieldLabel>
            <Input
              id={`${errorId}-title`}
              value={title}
              maxLength={200}
              aria-invalid={empty || undefined}
              aria-describedby={empty ? errorId : undefined}
              onChange={(event) => {
                setTitle(event.target.value)
                setEmpty(false)
              }}
            />
            {empty && <FieldError id={errorId}>{m['library.rename_empty']()}</FieldError>}
          </Field>
          {rename.isError && <InlineError title={apiErrorMessage(errorCode(rename.error))} />}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {m['common.cancel']()}
            </Button>
            <Button type="submit" variant="primary" loading={rename.isPending}>
              {m['common.save']()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Irreversible, so it asks first (26 §13); the copy names the song (27 §5.6 delete.song_confirm).
export function DeleteSongDialog({
  song,
  open,
  onOpenChange,
  onDeleted,
}: DialogProps & { onDeleted: () => void }) {
  const remove = useMutation({
    mutationFn: () => client.songs.delete({ id: song.id }),
    onSuccess: () => {
      onOpenChange(false)
      onDeleted()
      toast.add({ title: m['library.deleted'](), type: 'success' })
    },
  })
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{m['library.delete']()}</AlertDialogTitle>
          <AlertDialogDescription>
            {m['delete.song_confirm']({ title: song.title })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {remove.isError && <InlineError title={apiErrorMessage(errorCode(remove.error))} />}
        <AlertDialogFooter>
          <AlertDialogCancel>{m['common.cancel']()}</AlertDialogCancel>
          <Button variant="destructive" loading={remove.isPending} onClick={() => remove.mutate()}>
            {m['library.delete']()}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
