import { and, desc, eq } from 'drizzle-orm'
import { type Database, withUser } from '../client.ts'
import { uploads } from '../schema/index.ts'

export type Upload = typeof uploads.$inferSelect
export type NewUpload = Omit<typeof uploads.$inferInsert, 'userId' | 'createdAt'>
export type UploadPatch = Partial<
  Pick<Upload, 'songId' | 'status' | 'rejectReason' | 'container' | 'codec' | 'durationS'>
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

    // Instant "you already have this file" check before uploading (03 "Keys").
    findByFileSha256: (userId: string, fileSha256: string) =>
      withUser(db, userId, async (tx) => {
        const [row] = await tx
          .select()
          .from(uploads)
          .where(and(eq(uploads.userId, userId), eq(uploads.fileSha256, fileSha256)))
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
  }
}
