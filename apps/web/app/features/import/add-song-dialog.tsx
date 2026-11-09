import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { LinkIcon, MicIcon, UploadIcon, XIcon } from 'lucide-react'
import { useCallback, useEffect, useId, useState } from 'react'
import { client, errorCode, errorData } from '@/lib/api'
import { m } from '@/lib/i18n'
import type { InstrumentName } from '@/lib/instruments'
import { apiErrorMessage } from '@/lib/reasons'
import { reloadMe } from '@/lib/reload-me'
import type { MeData } from '@/lib/session'
import { track } from '@/lib/track'
import { useMediaQuery } from '@/lib/use-media-query'
import { useOnline } from '@/lib/use-online'
import { Button } from '@/ui/button'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/ui/dialog'
import { DropZone } from '@/ui/drop-zone'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
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
import { isImportableUrl, LinkPanel, type LinkRequest } from './link-panel'
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

// Add song (27 §3.6; AddSong and Phone-Add): a 940 px dialog over the library, a full-screen sheet
// on phones (56 px header, 48 px tabs). File · Link · Record, the last one used remembered; Your
// part and Analysis; "Start practising" opens Practice at once while the upload and the analysis
// carry on (27 §2 "Add a file"), and an upload keeps going after the dialog closes.
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
  const wide = useMediaQuery('(min-width: 640px)')
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<AddTab>(requested)
  const [instrument, setInstrument] = useState<InstrumentName>(me.primary_instrument ?? 'guitar')
  const [hand, setHand] = useState<Hand>(me.handedness)
  const available = analysisAvailability(me)
  const [type, setType] = useState<AnalysisKind>(available.full ? 'full' : 'lite')
  const file = usePickedFile()
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [recording, setRecording] = useState<File | undefined>()
  const [link, setLink] = useState<LinkRequest>({ url: '', downloadVideo: true })
  const [allowDuplicate, setAllowDuplicate] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [failure, setFailure] = useState<string | undefined>()
  const [waitingOnline, setWaitingOnline] = useState(false)
  const [upgrade, setUpgrade] = useState<Trigger | undefined>()
  const fieldId = useId()

  const onFile = useCallback(
    (picked: File) => {
      setTab('file')
      setAllowDuplicate(false)
      setFailure(undefined)
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
    rememberTab(value)
  }

  const changeHand = (value: Hand) => {
    setHand(value)
    void client.me.update({ handedness: value }).then(() => reloadMe(queryClient))
  }

  const typeAllowed = type === 'full' ? available.full : available.lite
  const ready =
    typeAllowed &&
    (tab === 'file'
      ? !file.blocked && (!file.picked?.duplicateOf || allowDuplicate)
      : tab === 'record'
        ? recording !== undefined
        : isImportableUrl(link.url))

  const submit = async () => {
    setFailure(undefined)
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

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          data-slot="add-song"
          className="flex max-h-[calc(100dvh-4rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-235 max-sm:inset-0 max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-none max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0"
        >
          <div className="flex shrink-0 items-center gap-3 pt-[env(safe-area-inset-top)] max-sm:h-14 max-sm:pr-2 max-sm:pl-4 sm:pt-5 sm:pr-5 sm:pl-6">
            <DialogTitle className="flex-1 text-xl max-sm:text-lg">
              {m['import.title']()}
            </DialogTitle>
            <DialogClose
              render={<Button variant="ghost" size="icon" aria-label={m['system.close']()} />}
            >
              <XIcon aria-hidden />
            </DialogClose>
          </div>
          <Tabs
            value={tab}
            onValueChange={(value) => changeTab(value as AddTab)}
            className="min-h-0 flex-1 gap-0"
          >
            <TabsList className="shrink-0 px-4 sm:mt-2 max-sm:grid max-sm:grid-cols-3 max-sm:px-2">
              {tabs.map(({ value, label, Icon }) => (
                <TabsTrigger key={value} value={value} className="max-sm:min-h-12">
                  <Icon aria-hidden className="max-sm:hidden" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="flex min-h-0 flex-1 flex-wrap gap-6 overflow-y-auto px-4 py-5 sm:px-6">
              <div className="flex min-w-0 flex-[999_1_26.25rem] flex-col">
                <TabsContent value="file" className="flex flex-col gap-3.5">
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
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`${fieldId}-title`}>{m['import.title_label']()}</Label>
                          <Input
                            id={`${fieldId}-title`}
                            value={title}
                            maxLength={200}
                            onChange={(event) => setTitle(event.target.value)}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`${fieldId}-artist`}>
                            {m['import.artist_label']()}{' '}
                            <span className="font-medium text-faint-foreground">
                              {m['import.optional']()}
                            </span>
                          </Label>
                          <Input
                            id={`${fieldId}-artist`}
                            value={artist}
                            maxLength={200}
                            placeholder={m['import.artist_placeholder']()}
                            onChange={(event) => setArtist(event.target.value)}
                          />
                        </div>
                      </div>
                      <DropZone
                        variant="row"
                        prompt={m['import.drop_another']()}
                        chooseLabel={m['import.choose_file']()}
                        hint={m['import.formats']()}
                        dropLabel={m['import.drop_here']()}
                        accept={ACCEPT}
                        onFiles={([picked]) => picked && onFile(picked)}
                      />
                    </>
                  ) : (
                    <DropZone
                      prompt={m['import.drop_prompt']()}
                      chooseLabel={m['import.choose_file']()}
                      hint={m['import.formats']()}
                      dropLabel={m['import.drop_here']()}
                      accept={ACCEPT}
                      onFiles={([picked]) => picked && onFile(picked)}
                      className="flex-1"
                    />
                  )}
                </TabsContent>
                <TabsContent value="link">
                  <LinkPanel value={link} onChange={setLink} />
                </TabsContent>
                <TabsContent value="record">
                  <RecordPanel onRecording={setRecording} />
                </TabsContent>
              </div>
              <div className="flex min-w-0 flex-[1_1_21.25rem] flex-col gap-4">
                {available.full && type !== 'full' && !available.plus && (
                  <InlineError
                    tone="info"
                    title={m['plan.welcome_available']()}
                    actions={
                      <Button onClick={() => setType('full')}>{m['plan.use_it_now']()}</Button>
                    }
                  />
                )}
                <PartPicker
                  instrument={instrument}
                  onInstrumentChange={setInstrument}
                  hand={hand}
                  onHandChange={changeHand}
                  compact={!wide}
                />
                <AnalysisChoice
                  me={me}
                  type={type}
                  onTypeChange={setType}
                  onSeePlus={setUpgrade}
                  compact={!wide}
                />
                {waitingOnline && <InlineError tone="warning" title={m['import.offline']()} />}
                {failure && <InlineError title={failure} />}
              </div>
            </div>
          </Tabs>
          <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-border px-4 pt-3 pb-[calc(var(--spacing)*5.5+env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
            <p className="flex-[1_1_18.75rem] text-sm text-muted-foreground max-sm:hidden">
              {m['import.opens_now']()}{' '}
              <Popover>
                <PopoverTrigger
                  render={<Button variant="link" className="h-auto min-h-0 px-0 text-sm" />}
                >
                  {m['import.works_best']()}
                </PopoverTrigger>
                <PopoverContent
                  aria-label={m['import.works_best']()}
                  className="flex w-80 flex-col gap-2 text-sm"
                >
                  <p>{m['import.works_best_with']()}</p>
                  <p className="text-muted-foreground">{m['import.has_trouble_with']()}</p>
                </PopoverContent>
              </Popover>
            </p>
            <DialogClose render={<Button className="max-sm:hidden" />}>
              {m['common.cancel']()}
            </DialogClose>
            <Button
              variant="primary"
              size="lg"
              disabled={!ready}
              loading={submitting}
              onClick={submit}
              className="max-sm:w-full"
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
