import { describe, expect, it } from 'vitest'
import { barNumberText, printedBarNumber, renumberBars } from '../src/bar-numbers.ts'

describe('bar numbers', () => {
  it('recognises what alphaTab prints for a bar number and nothing else', () => {
    expect(printedBarNumber('1  ')).toBe(1)
    expect(printedBarNumber('128  ')).toBe(128)
    // A fret, a tuplet, a time signature digit and a chord name are not bar numbers.
    for (const text of ['3', '12', '3 ', ' 3  ', 'Am', '4  4', '']) {
      expect([text, printedBarNumber(text)]).toEqual([text, null])
    }
  })

  it('counts from the first full bar: a pickup prints nothing and the next bar is 1', () => {
    // A song with a pickup: alphaTab bar 0 is grid bar −1.
    expect(barNumberText(1, -1)).toBe('')
    expect(barNumberText(2, -1)).toBe('1  ')
    expect(barNumberText(9, -1)).toBe('8  ')
  })

  it('leaves a score that starts on bar 1 as alphaTab numbered it', () => {
    expect(barNumberText(1, 0)).toBe('1  ')
    expect(barNumberText(17, 0)).toBe('17  ')
  })

  it('follows a tab that starts later in the song', () => {
    expect(barNumberText(1, 16)).toBe('17  ')
  })

  it('rewrites the printed numbers in place, from what alphaTab drew, every time', () => {
    const text = (content: string) => {
      const attributes = new Map<string, string>()
      return {
        textContent: content,
        getAttribute: (name: string) => attributes.get(name) ?? null,
        setAttribute: (name: string, value: string) => void attributes.set(name, value),
      }
    }
    const nodes = [text('1  '), text('2  '), text('3'), text('Am'), text('5  ')]
    const root = { querySelectorAll: () => nodes } as unknown as ParentNode
    renumberBars(root, -1)
    expect(nodes.map((node) => node.textContent)).toEqual(['', '1  ', '3', 'Am', '4  '])
    // A second pass does not shift them again, and a changed grid starts from the original.
    renumberBars(root, -1)
    expect(nodes.map((node) => node.textContent)).toEqual(['', '1  ', '3', 'Am', '4  '])
    renumberBars(root, 0)
    expect(nodes.map((node) => node.textContent)).toEqual(['1  ', '2  ', '3', 'Am', '5  '])
  })
})
