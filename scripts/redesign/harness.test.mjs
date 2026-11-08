import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FIXED_LOOK, planRenders, readBoards, splitList, WIDTHS } from './harness.mjs'

const boards = readBoards()
const byName = (name) => boards.find((board) => board.name === name)

describe('readBoards', () => {
  it('lists all 25 mockups with their canvas size and looks', () => {
    expect(boards).toHaveLength(25)
    expect(byName('Main')).toMatchObject({ width: 1440, height: 900, fluid: true })
    expect(byName('Main').looks).toEqual(['night', 'daylight'])
    expect(byName('Phone-Practice')).toMatchObject({ width: 390, height: 844, fluid: false })
    expect(byName('System').looks).toEqual([FIXED_LOOK])
  })

  it('fails when a mockup is missing from canvas.json', () => {
    const dir = mkdtempSync(join(tmpdir(), 'redesign-boards-'))
    writeFileSync(join(dir, 'canvas.json'), JSON.stringify({ boards: {} }))
    writeFileSync(join(dir, 'Stray.dc.html'), "<script data-props='{}'></script>")
    expect(() => readBoards(dir)).toThrow('Stray.dc.html: not in canvas.json')
  })
})

describe('planRenders', () => {
  it('renders fluid boards at every width and fixed boards at their own width only', () => {
    const { jobs, skips } = planRenders(boards)
    const fluid = boards.filter((board) => board.fluid)
    const fixed = boards.filter((board) => !board.fluid)
    const expected =
      fluid.reduce((n, board) => n + board.looks.length * WIDTHS.length, 0) +
      fixed.reduce((n, board) => n + board.looks.length, 0)
    expect(jobs).toHaveLength(expected)
    const phone = jobs.filter((job) => job.board.name === 'Phone-Practice')
    expect(phone.map((job) => [job.look, job.width])).toEqual([
      ['night', 390],
      ['daylight', 390],
    ])
    expect(skips).toContain('Phone-Practice: fixed 390px board, skipped width 1440, 1180')
    expect(skips).toContain('Dir-A: no look prop, renders its fixed look only (no night/daylight)')
  })

  it('applies file, width and look filters', () => {
    const { jobs } = planRenders(boards, {
      files: ['Main.dc.html', 'Phone-Tools'],
      widths: [390],
      looks: ['daylight'],
    })
    expect(jobs.map((job) => `${job.board.name} ${job.look} ${job.width}`)).toEqual([
      'Main daylight 390',
      'Phone-Tools daylight 390',
    ])
  })

  it('rejects an unknown file', () => {
    expect(() => planRenders(boards, { files: ['Nope'] })).toThrow('unknown mockup: Nope')
  })
})

describe('splitList', () => {
  it('accepts repeated and comma-separated values', () => {
    expect(splitList(['1440,390', '1180'], Number)).toEqual([1440, 390, 1180])
    expect(splitList(undefined)).toEqual([])
  })
})
