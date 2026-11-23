import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { LinkIcon, MicIcon, UploadIcon, XIcon } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { client, errorCode, errorData } from '@/lib/api'
import { m } from '@/lib/i18n'
import type { InstrumentName } from '@/lib/instruments'
import { apiErrorMessage } from '@/lib/reasons'
import { reloadMe } from '@/lib/reload-me'
import type { MeData } from '@/lib/session'
import { track } from '@/lib/track'
import { useOnline } from '@/lib/use-online'
import { Button } from '@/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/ui/dialog'
import { DropZone } from '@/ui/drop-zone'
import { Field, FieldLabel } from '@/ui/field'
import { Input } from '@/ui/input'
import { Popover, PopoverTrigger } from '@/ui/popover'
import { PopoverContent } from '@/ui/popover-content'
import { InlineError } from '@/ui/status-message'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs'
import type { Trigger } from '../billing/plans'
import { UpgradeSheet } from '../billing/upgrade-sheet'
import { type AddTab, rememberTab, usePendingFile } from './add-song-state'
import { AnalysisChoice, type AnalysisKind, analysisAvailability } from './analysis-choice'
import { FileRow } from './file-row'
import { hashFile } from './hash'
import { isImportableUrl, LINK_FIELD_ID, LinkPanel, type LinkRequest } from './link-panel'
import { type Hand, PartPicker } from './part-picker'
import { RecordPanel } from './record-panel'
import { DuplicateSongError, startImport } from './upload-manager'
import { usePickedFile } from './use-picked-file'

const ACCEPT = 'audio/*,video/*,.mp3,.m4a,.wav,.aif,.aiff,.flac,.ogg,.opus,.mp4,.mov,.webm'

const titleOf = (file: File) =>
  file.name
    .replace(/\.[^.]+$/, '')
    .trim()
    .slice(0, 200) || file.name

/** What stops a submit, so it can say so beside the cause and move focus there. */
type Problem = 'no_file' | 'file' | 'duplicate' | 'link' | 'no_recording' | 'allowance'

// Add song (27 §3.6; AddSong and Phone-Add): one 640 px column over the library, a full-screen
// sheet on phones. The title with its one promise ("It opens right away"), File · Link · Record
// as compact tabs (the last one used remembered; focus starts on the chosen tab), the source,
// then Your part and Analysis under a hairline. The body is one scrolling column whose parts keep
// their own height, so nothing in a tab can draw over the part rows. The primary is never
// disabled in advance: pressed too early it says what is missing beside it and moves focus there.
// It opens Practice at once while the upload and the analysis carry on (27 §2 "Add a file"), and
// an upload keeps going after the dialog closes.
export default function AddSongDialog({
  me,
  tab: requested,
  onClose,
}: {
  me: MeData
  tab: AddTab
  onClose: () => void
}) {
  const navigate = useNavigate()
  const online = useOnline()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<AddTab>(requested)
  const [instrument, setInstrument] = useState<InstrumentName>(me.primary_instrument ?? 'guitar')
  const [hand, setHand] = useState<Hand>(me.handedness)
  const available = analysisAvailability(me)
  const [type, setType] = useState<AnalysisKind>(
    available.full ? 'full' : available.lite ? 'lite' : 'full',
  )
  const file = usePickedFile()
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [recording, setRecording] = useState<File | undefined>()
  const [link, setLink] = useState<LinkRequest>({ url: '', downloadVideo: true })
  const [allowDuplicate, setAllowDuplicate] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [failure, setFailure] = useState<string | undefined>()
  const [waitingOnline, setWaitingOnline] = useState(false)
  const [upgrade, setUpgrade] = useState<Trigger | undefined>()
  const fieldId = useId()
  const body = useRef<HTMLDivElement>(null)

  const onFile = useCallback(
    (picked: File) => {
      setTab('file')
      setAllowDuplicate(false)
      setFailure(undefined)
      setAttempted(false)
      setTitle(titleOf(picked))
      void file.pick(picked)
    },
    [file.pick],
  )

  // A file dropped anywhere in the app shell (or dropped again while this is open).
  const pending = usePendingFile((s) => s.file)
  useEffect(() => {
    if (!pending) return
    usePendingFile.setState({ file: undefined })
    onFile(pending)
  }, [pending, onFile])

  const changeTab = (value: AddTab) => {
    setTab(value)
    setFailure(undefined)
    setAttempted(false)
    rememberTab(value)
  }

  const changeHand = (value: Hand) => {
    setHand(value)
    void client.me.update({ handedness: value }).then(() => reloadMe(queryClient))
  }

  const reading = tab === 'file' && file.picked?.status === 'reading'
  const problem: Problem | undefined = !(type === 'full' ? available.full : available.lite)
    ? 'allowance'
    : tab === 'file'
      ? !file.picked
        ? 'no_file'
        : file.blocked
          ? 'file'
          : file.picked.duplicateOf && !allowDuplicate
            ? 'duplicate'
            : undefined
      : tab === 'record'
        ? recording
          ? undefined
          : 'no_recording'
        : isImportableUrl(link.url)
          ? undefined
          : 'link'

  /** Moves focus to what needs the learner: the field, the file's way out, the allowance. */
  const focusProblem = (found: Problem) => {
    const root = body.current
    if (!root) return
    const selector: Record<Problem, string> = {
      link: `#${LINK_FIELD_ID}`,
      allowance:
        '[data-analysis] [data-slot=choice-row]:not([data-disabled]), [data-analysis] [data-slot=inline-error] button',
      no_file: '[data-slot=drop-zone] button',
      file: '[data-slot=file-card] [data-slot=inline-error] button',
      duplicate: '[data-slot=file-card] [data-slot=inline-error] button',
      no_recording: '[data-record] button',
    }
    const target = root.querySelector<HTMLElement>(selector[found])
    target?.focus()
  }

  const submit = async () => {
    setFailure(undefined)
    if (problem) {
      setAttempted(true)
      // After the messages render, so focus lands on what they point at.
      requestAnimationFrame(() => focusProblem(problem))
      return
    }
    if (!online) {
      setWaitingOnline(true)
      return
    }
    setWaitingOnline(false)
    setSubmitting(true)
    try {
      if (tab === 'link') {
        const accepted = await client.songs.importUrl({
          url: link.url.trim(),
          instrument,
          type,
          download_video: link.downloadVideo,
        })
        void reloadMe(queryClient)
        track('link_import_started', { type })
        await navigate({ to: '/songs/$songId/practice', params: { songId: accepted.song_id } })
        return
      }
      const source = tab === 'record' ? recording : file.picked?.file
      const sha256 = tab === 'record' ? undefined : file.picked?.sha256
      if (!source) return
      const songId = await startImport({
        file: source,
        fileSha256: sha256 ?? (await hashFile(source)),
        title: (tab === 'file' && title.trim()) || titleOf(source),
        artist: tab === 'file' ? artist.trim() || undefined : undefined,
        sourceKind: tab === 'record' ? 'recording' : 'upload',
        instrument,
        type,
        allowDuplicate,
      })
      await navigate({ to: '/songs/$songId/practice', params: { songId } })
    } catch (error) {
      if (error instanceof DuplicateSongError) {
        await navigate({ to: '/songs/$songId/practice', params: { songId: error.songId } })
        return
      }
      setFailure(apiErrorMessage(errorCode(error), errorData(error)))
    } finally {
      setSubmitting(false)
    }
  }

  // "You're offline. We'll start the upload when you're back." (27 §5.6 import.offline)
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once when the connection returns
  useEffect(() => {
    if (online && waitingOnline) void submit()
  }, [online, waitingOnline])

  const primaryLabel =
    tab === 'link'
      ? m['import.import_and_analyse']()
      : tab === 'record'
        ? m['import.use_recording']()
        : m['import.start_practising']()

  const tabs: { value: AddTab; label: string; Icon: typeof UploadIcon }[] = [
    { value: 'file', label: m['import.tab_file'](), Icon: UploadIcon },
    { value: 'link', label: m['import.tab_link'](), Icon: LinkIcon },
    { value: 'record', label: m['import.tab_record'](), Icon: MicIcon },
  ]
  const show = (kind: Problem) => attempted && problem === kind

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          data-slot="add-song"
          initialFocus={() =>
            body.current?.querySelector<HTMLElement>('[data-slot=tabs-trigger][data-active]') ??
            null
          }
          className="flex max-h-[calc(100dvh-4rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-160 max-sm:inset-0 max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-none max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0"
        >
          <div className="flex shrink-0 items-start gap-3 px-4 pt-[calc(env(safe-area-inset-top)+--spacing(4))] sm:px-6 sm:pt-6">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <DialogTitle>{m['import.title']()}</DialogTitle>
              <DialogDescription>{m['import.opens_now']()}</DialogDescription>
            </div>
            <DialogClose
              render={
                <Button
                  variant="quiet"
                  size="icon"
                  aria-label={m['system.close']()}
                  className="-mt-2 -mr-2"
                />
              }
            >
              <XIcon aria-hidden />
            </DialogClose>
          </div>
          <Tabs
            value={tab}
            onValueChange={(value) => changeTab(value as AddTab)}
            className="min-h-0 flex-1 gap-0"
          >
            <div ref={body} className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 sm:px-6">
              <TabsList look="pill" className="mt-4 mb-4 sm:mt-5">
                {tabs.map(({ value, label, Icon }) => (
                  <TabsTrigger key={value} value={value}>
                    <Icon aria-hidden />
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
              <TabsContent value="file" className="flex flex-col gap-4">
                {file.picked ? (
                  <>
                    <FileRow
                      picked={file.picked}
                      onRemove={() => {
                        file.clear()
                        setTitle('')
                      }}
                      onImportAnyway={() => setAllowDuplicate(true)}
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor={`${fieldId}-title`}>
                          {m['import.title_label']()}
                        </FieldLabel>
                        <Input
                          id={`${fieldId}-title`}
                          value={title}
                          maxLength={200}
                          onChange={(event) => setTitle(event.target.value)}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor={`${fieldId}-artist`}>
                          {m['import.artist_label']()}{' '}
                          <span className="text-faint-foreground">{m['import.optional']()}</span>
                        </FieldLabel>
                        <Input
                          id={`${fieldId}-artist`}
                          value={artist}
                          maxLength={200}
                          placeholder={m['import.artist_placeholder']()}
                          onChange={(event) => setArtist(event.target.value)}
                        />
                      </Field>
                    </div>
                  </>
                ) : (
                  <>
                    <DropZone
                      prompt={m['import.drop_prompt']()}
                      chooseLabel={m['import.choose_file']()}
                      hint={m['import.formats']()}
                      dropLabel={m['import.drop_here']()}
                      accept={ACCEPT}
                      onFiles={([picked]) => picked && onFile(picked)}
                      className="min-h-48 py-8"
                    />
                    {show('no_file') && <InlineError title={m['import.need_file']()} />}
                  </>
                )}
              </TabsContent>
              <TabsContent value="link">
                <LinkPanel value={link} onChange={setLink} checked={show('link')} />
              </TabsContent>
              <TabsContent value="record" data-record className="flex flex-col gap-4">
                <RecordPanel onRecording={setRecording} onUseTab={changeTab} />
                {show('no_recording') && <InlineError title={m['import.need_recording']()} />}
              </TabsContent>
              <div className="mt-6 flex flex-col gap-5 border-t border-border pt-4">
                <PartPicker
                  instrument={instrument}
                  onInstrumentChange={setInstrument}
                  hand={hand}
                  onHandChange={changeHand}
                />
                <div className="flex flex-col gap-2">
                  <AnalysisChoice
                    me={me}
                    type={type}
                    onTypeChange={setType}
                    onSeePlus={setUpgrade}
                  />
                  {available.full && type !== 'full' && !available.plus && (
                    <InlineError
                      tone="info"
                      title={m['plan.welcome_available']()}
                      actions={
                        <Button onClick={() => setType('full')}>{m['plan.use_it_now']()}</Button>
                      }
                    />
                  )}
                </div>
                {waitingOnline && <InlineError tone="warning" title={m['import.offline']()} />}
                {failure && <InlineError title={failure} />}
              </div>
            </div>
          </Tabs>
          <div className="flex shrink-0 items-center gap-2 border-t border-border px-4 pt-3 pb-[calc(--spacing(3)+env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    variant="link"
                    className="mr-auto px-0 text-muted-foreground hover:text-foreground max-sm:hidden"
                  />
                }
              >
                {m['import.works_best']()}
              </PopoverTrigger>
              <PopoverContent
                aria-label={m['import.works_best']()}
                className="flex flex-col gap-2 text-body-sm"
              >
                <p>{m['import.works_best_with']()}</p>
                <p className="text-muted-foreground">{m['import.has_trouble_with']()}</p>
              </PopoverContent>
            </Popover>
            <DialogClose render={<Button variant="quiet" className="max-sm:hidden" />}>
              {m['common.cancel']()}
            </DialogClose>
            <Button
              variant="primary"
              loading={submitting || reading}
              onClick={submit}
              className="max-sm:w-full max-sm:[--face:3rem]"
            >
              {primaryLabel}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <UpgradeSheet
        open={upgrade !== undefined}
        onClose={() => setUpgrade(undefined)}
        trigger={upgrade ?? 'cap_full'}
        returnPath="/library?add=file"
      />
    </>
  )
}
