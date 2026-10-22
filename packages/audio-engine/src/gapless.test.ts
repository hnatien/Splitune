import { describe, expect, it } from 'vitest'
import { itunesGapless } from './gapless.ts'

const encode = (text: string) => new TextEncoder().encode(text)

function file(record: string): Uint8Array {
  const head = encode('....moov....udta....----....iTunSMPB')
  const data = new Uint8Array(16) // data atom header
  return new Uint8Array([...head, ...data, ...encode(record), 0, 0, ...encode('trailing')])
}

describe('itunesGapless', () => {
  it('reads the priming of an AudioToolbox gapless record', () => {
    const record = ' 00000000 00000840 000002F4 00000000000204CC 00000000 00000000'
    expect(itunesGapless(file(record))).toEqual({ priming: 2112, padding: 756, length: 132300 })
  })

  it('is undefined without a record or with a malformed one', () => {
    expect(itunesGapless(encode('ftypM4A moov elst'))).toBeUndefined()
    expect(itunesGapless(file(' zz'))).toBeUndefined()
  })
})
