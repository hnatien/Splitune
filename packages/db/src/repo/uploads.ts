import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm'
import { type Database, withUser } from '../client.ts'
import { uploads } from '../schema/index.ts'

export type Upload = typeof uploads.$inferSelect
export type NewUpload = Omit<typeof uploads.$inferInsert, 'userId' | 'createdAt'>
export type UploadPatch = Partial<
  Pick<
    Upload,
    | 'songId'
    | 'status'
    | 'rejectReason'
    | 'container'
    | 'codec'
    | 'durationS'
    | 'multipartUploadId'
    | 'partSize'
  >
>

export function uploadsRepo(db: Database) {
  return {
    create: (userId: string, input: NewUpload) =>
      withUser(db, userId, async (tx) => {
        const [row] = await tx
          .insert(uploads)
          .values({ ...input, userId })
          .returning()
        return row as Upload
      }),

    get: (userId: string, uploadId: string) =>
      withUser(db, userId, async (tx) => {
        const [row] = await tx
          .select()
          .from(uploads)
          .where(and(eq(uploads.userId, userId), eq(uploads.id, uploadId)))
        return row
      }),

    // Instant "you already have this file" check before uploading (03 "Keys"): the latest
    // completed upload of these bytes that still belongs to a song.
    findByFileSha256: (userId: string, fileSha256: string) =>
      withUser(db, userId, async (tx) => {
        const [row] = await tx
          .select()
          .from(uploads)
          .where(
            and(
              eq(uploads.userId, userId),
              eq(uploads.fileSha256, fileSha256),
              inArray(uploads.status, ['uploaded', 'validated']),
              isNotNull(uploads.songId),
            ),
          )
          .orderBy(desc(uploads.createdAt))
          .limit(1)
        return row
      }),

    update: (userId: string, uploadId: string, patch: UploadPatch) =>
      withUser(db, userId, async (tx) => {
        const [row] = await tx
          .update(uploads)
          .set(patch)
          .where(and(eq(uploads.userId, userId), eq(uploads.id, uploadId)))
          .returning()
        return row
      }),

    // Compare-and-set on status: applies `patch` only while the upload is still in `from`, so two
    // concurrent completes (or a complete racing an abort) cannot both win. Undefined if not.
    transition: (userId: string, uploadId: string, from: Upload['status'], patch: UploadPatch) =>
      withUser(db, userId, async (tx) => {
        const [row] = await tx
          .update(uploads)
          .set(patch)
          .where(
            and(eq(uploads.userId, userId), eq(uploads.id, uploadId), eq(uploads.status, from)),
          )
          .returning()
        return row
      }),
  }
}
