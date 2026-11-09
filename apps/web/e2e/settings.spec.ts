import { expect, test } from '@playwright/test'
import { expectAccessible, projectContext, signIn } from './helpers'

// Settings IA (27 §1 route map, §3.9): Account · Display & practice · Keyboard & pedal · About.
// The old section URLs land on Account's anchors and keep the return states.

test('old settings URLs land on Account with the query kept, and About exists', async ({
  browser,
}) => {
  const context = await projectContext(browser, { serviceWorkers: 'block' })
  const page = await context.newPage()
  await signIn(page, 'settings')

  await page.goto('/settings')
  await expect(page).toHaveURL(/\/settings\/account$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Account' })).toBeVisible()

  await page.goto('/settings/profile?checkout=success')
  await expect(page).toHaveURL(/\/settings\/account\?checkout=success#plan$/)
  await page.goto('/settings/privacy?confirm=delete')
  await expect(page).toHaveURL(/\/settings\/account\?confirm=delete#privacy$/)
  await expect(page.getByRole('alertdialog', { name: 'Delete my account' })).toBeVisible()
  await page.keyboard.press('Escape')

  const nav = page.getByRole('navigation', { name: 'Settings sections' })
  await expect(nav.getByRole('link')).toHaveText([
    'Account',
    'Display & practice',
    'Keyboard & pedal',
    'About',
  ])
  await nav.getByRole('link', { name: 'About' }).click()
  await expect(page).toHaveURL(/\/settings\/about$/)
  await expect(page.getByRole('heading', { level: 1, name: 'About' })).toBeVisible()
  await expectAccessible(page)
  await context.close()
})
