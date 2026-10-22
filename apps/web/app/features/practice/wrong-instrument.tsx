import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { client, errorCode, errorData, orpc } from '@/lib/api'
import { m } from '@/lib/i18n'
import { INSTRUMENTS, type InstrumentName, instrumentLabel } from '@/lib/instruments'
import { apiErrorMessage } from '@/lib/reasons'
import { Button } from '@/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog'
import { OptionSelect } from '../common/option-select'

// "Wrong instrument": pick the right part and analyse again for it (it counts like any analysis).
export function WrongInstrument({
  songId,
  current,
  analysisType,
  onClose,
}: {
  songId: string
  current: InstrumentName
  analysisType: 'full' | 'lite'
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [instrument, setInstrument] = useState<InstrumentName>(current)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await client.songs.update({ id: songId, instrument })
      await client.analyses.create({ song_id: songId, instrument, type: analysisType })
      await queryClient.invalidateQueries({
        queryKey: orpc.songs.get.queryKey({ input: { id: songId } }),
      })
      onClose()
    } catch (failure) {
      setError(apiErrorMessage(errorCode(failure), errorData(failure)))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m['practice.audition_wrong_title']()}</DialogTitle>
          <DialogDescription>{m['practice.audition_wrong_body']()}</DialogDescription>
        </DialogHeader>
        <OptionSelect
          label={m['import.your_part']()}
          value={instrument}
          options={INSTRUMENTS.map((value) => ({ value, label: instrumentLabel(value) }))}
          onChange={setInstrument}
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {m['common.cancel']()}
          </Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={instrument === current}
            onClick={() => void submit()}
          >
            {m['practice.audition_analyse_again']()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
