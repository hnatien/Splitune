import { describe, expect, it } from 'vitest'
import { toAccount } from './account-redirect'

// 27 §1 route map: the old section URLs land on Account's anchors with the return states kept.
const thrown = (run: () => unknown) => {
  try {
    run()
  } catch (error) {
    return (error as { options: unknown }).options
  }
  throw new Error('expected a redirect')
}

describe('toAccount', () => {
  it('sends /settings/profile?checkout=success to /settings/account#plan with the query', () => {
    expect(thrown(() => toAccount('profile', { checkout: 'success' }))).toMatchObject({
      to: '/settings/account',
      hash: 'plan',
      search: { checkout: 'success' },
      replace: true,
    })
  })

  it('keeps ?confirm=delete on the way to #privacy', () => {
    expect(thrown(() => toAccount('privacy', { confirm: 'delete' }))).toMatchObject({
      hash: 'privacy',
      search: { confirm: 'delete' },
    })
  })

  it('drops values Account does not understand', () => {
    expect(
      thrown(() => toAccount('profile', { checkout: 'sideways', confirm: 1, other: 'x' })),
    ).toMatchObject({ hash: 'profile', search: {} })
  })
})
