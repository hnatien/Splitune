import { describe, expect, it } from 'vitest'
import { apiErrorMessage } from './reasons'

describe('apiErrorMessage', () => {
  it('says link import is broken when it was switched off, unsupported otherwise', () => {
    expect(apiErrorMessage('url_unsupported', { reason: 'import_disabled' })).toBe(
      'Link import is temporarily broken. Upload a file instead.',
    )
    expect(apiErrorMessage('url_unsupported')).toBe(
      "We can't import from this link. Try uploading the audio file instead.",
    )
  })
})
