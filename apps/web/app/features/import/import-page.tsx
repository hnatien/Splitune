import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { client, errorCode, errorData } from '@/lib/api'
import { m } from '@/lib/i18n'
import type { InstrumentName } from '@/lib/instruments'
import { apiErrorMessage } from '@/lib/reasons'
import { reloadMe } from '@/lib/reload-me'
import type { MeData } from '@/lib/session'
import { track } from '@/lib/track'
import { useOnline } from '@/lib/use-online'
import { Button } from '@/ui/button'
import { DropZone } from '@/ui/drop-zone'
import { InlineError } from '@/ui/status-message'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs'
import type { Trigger } from '../billing/plans'
import { UpgradeSheet } from '../billing/upgrade-sheet'
import { AnalysisChoice, type AnalysisKind, analysisAvailability } from './analysis-choice'
import { FileRow } from './file-row'
import { hashFile } from './hash'
import { isImportableUrl, LinkPanel, type LinkRequest } from './link-panel'
import { RecordPanel } from './record-panel'
import { DuplicateSongError, startImport } from './upload-manager'
import { usePickedFile } from './use-picked-file'

export type ImportTab = 'file' | 'link' | 'record'
type Tab = ImportTab

const TAB_KEY = 'splitune.import.tab'
const ACCEPT = 'audio/*,video/*,.mp3,.m4a,.wav,.aif,.aiff,.flac,.ogg,.opus,.mp4,.mov,.webm'

function storedTab(): Tab {
  try {
    const value = localStorage.getItem(TAB_KEY)
    return value === 'link' || value === 'record' ? value : 'file'
  } catch {
    return 'file'
  }
}

const titleOf = (file: File) =>
  file.name
    .replace(/\.[^.]+$/, '')
    .trim()
    .slice(0, 200) || file.name

/** Drops anywhere on the page land in the file tab (27 §3.6). */
function usePageDrop(onFile: (file: File) => void) {
  const [dragging, setDragging] = useState(false)
  useEffect(() => {
    let depth = 0
    const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false
    const enter = (event: DragEvent) => {
      if (!hasFiles(event)) return
      depth++
      setDragging(true)
    }
    const leave = () => {
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const over = (event: DragEvent) => {
      if (hasFiles(event)) event.preventDefault()
    }
    const drop = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      depth = 0
      setDragging(false)
      const file = event.dataTransfer?.files[0]
      if (file) onFile(file)
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave)
    window.addEventListener('dragover', over)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('dragover', over)
      window.removeEventListener('drop', drop)
    }
  }, [onFile])
  return dragging
}

export function ImportPage({ me, tab: requested }: { me: MeData; tab?: Tab | undefined }) {
  const navigate = useNavigate()
  const online = useOnline()
  const [tab, setTab] = useState<Tab>(() => requested ?? storedTab())
  const [instrument, setInstrument] = useState<InstrumentName>(me.primary_instrument ?? 'guitar')
  const available = analysisAvailability(me)
  const [type, setType] = useState<AnalysisKind>(available.full ? 'full' : 'lite')
  const file = usePickedFile()
  const [recording, setRecording] = useState<File | undefined>()
  const [link, setLink] = useState<LinkRequest>({ url: '', downloadVideo: true })
  const [allowDuplicate, setAllowDuplicate] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [failure, setFailure] = useState<string | undefined>()
  const [waitingOnline, setWaitingOnline] = useState(false)
  const [upgrade, setUpgrade] = useState<Trigger | undefined>()
  const queryClient = useQueryClient()

  const onFile = useCallback(
    (picked: File) => {
      setTab('file')
      setAllowDuplicate(false)
      setFailure(undefined)
      void file.pick(picked)
    },
    [file.pick],
  )
  const dragging = usePageDrop(onFile)

  const changeTab = (value: Tab) => {
    setTab(value)
    setFailure(undefined)
    try {
      localStorage.setItem(TAB_KEY, value)
    } catch {
      // Remembering the tab is a convenience only.
    }
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
        title: titleOf(source),
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

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl">{m['import.title']()}</h1>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Tabs
          value={tab}
          onValueChange={(value) => changeTab(value as Tab)}
          className="flex flex-col gap-5"
        >
          <TabsList>
            <TabsTrigger value="file">{m['import.tab_file']()}</TabsTrigger>
            <TabsTrigger value="link">{m['import.tab_link']()}</TabsTrigger>
            <TabsTrigger value="record">{m['import.tab_record']()}</TabsTrigger>
          </TabsList>
          <TabsContent value="file" className="flex flex-col gap-4">
            {file.picked ? (
              <FileRow
                picked={file.picked}
                onRemove={file.clear}
                onImportAnyway={() => setAllowDuplicate(true)}
              />
            ) : (
              <DropZone
                prompt={m['import.drop_prompt']()}
                chooseLabel={m['import.choose_file']()}
                hint={m['import.formats']()}
                dropLabel={m['import.drop_here']()}
                dragging={dragging}
                accept={ACCEPT}
                onFiles={([picked]) => picked && onFile(picked)}
              />
            )}
          </TabsContent>
          <TabsContent value="link">
            <LinkPanel value={link} onChange={setLink} />
          </TabsContent>
          <TabsContent value="record">
            <RecordPanel onRecording={setRecording} />
          </TabsContent>
        </Tabs>
        <aside className="flex flex-col gap-6">
          {me.usage.welcome_available && (
            <InlineError
              tone="info"
              title={m['plan.welcome_available']()}
              actions={
                type !== 'full' && (
                  <Button variant="outline" onClick={() => setType('full')}>
                    {m['plan.use_it_now']()}
                  </Button>
                )
              }
            />
          )}
          <AnalysisChoice
            me={me}
            instrument={instrument}
            onInstrumentChange={setInstrument}
            type={type}
            onTypeChange={setType}
            onSeePlus={setUpgrade}
          />
          {waitingOnline && <InlineError tone="warning" title={m['import.offline']()} />}
          {failure && <InlineError title={failure} />}
          <Button
            variant="primary"
            disabled={!ready}
            loading={submitting}
            onClick={submit}
            className="self-start"
          >
            {tab === 'link'
              ? m['import.import_and_analyse']()
              : tab === 'record'
                ? m['import.use_recording']()
                : m['import.start_practising']()}
          </Button>
        </aside>
      </div>
      <UpgradeSheet
        open={upgrade !== undefined}
        onClose={() => setUpgrade(undefined)}
        trigger={upgrade ?? 'cap_full'}
        returnPath="/import"
      />
    </div>
  )
}
