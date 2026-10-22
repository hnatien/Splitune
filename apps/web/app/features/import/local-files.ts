// Files this page uploads, by song: practice plays them locally before the server has the song
// (27 §3.7.3 "Local audio only"). Apart from the uploader so practice doesn't load it.
const files = new Map<string, File>()

export function keepLocalFile(songId: string, file: File) {
  files.set(songId, file)
}

/** The file this page uploaded (or is uploading) for a song, if it still has it. */
export function localFile(songId: string): File | undefined {
  return files.get(songId)
}
