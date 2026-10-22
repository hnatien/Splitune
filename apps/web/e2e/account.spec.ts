import { expect, test } from '@playwright/test'
import pg from 'pg'
import { collectErrors, expectAccessible, projectContext, signIn, wav } from './helpers'

// Release gate (24 §6): account deletion. Settings → Privacy → Delete account ends the session at
// once, lands on /account-deleted, and the Mac's node worker removes the account's rows (15 §4;
// objects are checked by the API's privacy test). A session younger than 10 minutes needs no
// fresh sign-in.

test('a learner deletes their account and everything in it goes', async ({ browser }) => {
  const context = await projectContext(browser, { serviceWorkers: 'block' })
  const page = await context.newPage()
  await signIn(page, `e2e-account-${test.info().project.name}-${Date.now()}@splitune.localhost`)
  const errors = collectErrors(page)
  const me = (await (await page.request.get('/v1/me')).json()) as { id: string }

  // Something to delete: a song with an upload.
  await page.goto('/import')
  await page.getByRole('tab', { name: 'File' }).click()
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'Delete me.wav', mimeType: 'audio/wav', buffer: wav(3) })
  await page.getByRole('button', { name: 'Start practising' }).click()
  await expect(page).toHaveURL(/\/songs\/[0-9a-f-]+\/practice/)
  // The upload is complete once its analysis exists (leaving earlier makes the next page finish
  // it again, which the API answers with an expected 409).
  await expect
    .poll(
      async () => {
        const { items } = (await (await page.request.get('/v1/songs')).json()) as {
          items: { latest_analysis: object | null }[]
        }
        return items.filter((song) => song.latest_analysis !== null).length
      },
      { timeout: 30_000 },
    )
    .toBe(1)

  await page.goto('/settings/privacy')
  await expect(page.getByRole('heading', { name: 'Delete my account' })).toBeVisible()
  await expectAccessible(page)
  await page.getByRole('button', { name: 'Delete account' }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Delete my account' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Delete account' }).click()

  await expect(page).toHaveURL(/\/account-deleted$/)
  await expect(page.getByRole('heading', { name: 'Your account was deleted' })).toBeVisible()
  await expectAccessible(page)
  expect((await page.request.get('/v1/me')).status()).toBe(401)
  await page.goto('/library')
  await expect(page).toHaveURL(/\/auth\/sign-in/)

  const { E2E_DATABASE_URL: connectionString } = process.env
  const db = new pg.Client({ connectionString })
  await db.connect()
  try {
    await expect
      .poll(
        async () => {
          const { rows } = await db.query<{ users: number; songs: number; uploads: number }>(
            `select (select count(*) from users where id = $1)::int as users,
                    (select count(*) from songs where user_id = $1)::int as songs,
                    (select count(*) from uploads where user_id = $1)::int as uploads`,
            [me.id],
          )
          return rows[0]
        },
        { timeout: 60_000 },
      )
      .toEqual({ users: 0, songs: 0, uploads: 0 })
  } finally {
    await db.end()
  }
  expect(errors).toEqual([])
  await context.close()
})
