import { describe, expect, it } from 'vitest'
import { initialTier, type UnderrunEvent, UnderrunMonitor } from './tiers.ts'

describe('initialTier', () => {
  it('starts low-memory, few-core devices on the cheaper preset', () => {
    expect(initialTier({ deviceMemory: 4, hardwareConcurrency: 4 })).toBe('mid')
    expect(initialTier({ deviceMemory: 4, hardwareConcurrency: 8 })).toBe('high')
    expect(initialTier({ hardwareConcurrency: 2 })).toBe('high') // Safari: no deviceMemory
  })
})

describe('UnderrunMonitor', () => {
  it('steps down after two hot load windows in a row, never below low', () => {
    const steps: UnderrunEvent[] = []
    const monitor = new UnderrunMonitor('high', (event) => steps.push(event))
    monitor.load(0.9)
    monitor.load(0.5)
    monitor.load(0.9)
    expect(steps).toEqual([])
    monitor.load(0.95)
    expect(steps).toEqual([{ tier: 'mid', previous: 'high', reason: 'load', load: 0.95 }])
    for (let i = 0; i < 6; i++) monitor.load(1)
    expect(steps.map((step) => step.tier)).toEqual(['mid', 'low'])
    expect(monitor.tier).toBe('low')
  })

  it('reports a glitch when context time falls behind wall time', () => {
    const steps: UnderrunEvent[] = []
    const monitor = new UnderrunMonitor('high', (event) => steps.push(event))
    monitor.sample(10, 0)
    monitor.sample(11, 1000)
    monitor.sample(11.95, 2000)
    expect(steps).toEqual([{ tier: 'mid', previous: 'high', reason: 'glitch', load: undefined }])
  })

  it('only reports underruns when not adaptive', () => {
    const steps: UnderrunEvent[] = []
    const monitor = new UnderrunMonitor('high', (event) => steps.push(event), false)
    monitor.load(0.9)
    monitor.load(0.9)
    expect(steps).toEqual([{ tier: 'high', previous: 'high', reason: 'load', load: 0.9 }])
    expect(monitor.tier).toBe('high')
  })

  it('does not count a pause as a glitch after reset', () => {
    const steps: UnderrunEvent[] = []
    const monitor = new UnderrunMonitor('high', (event) => steps.push(event))
    monitor.sample(10, 0)
    monitor.reset()
    monitor.sample(10, 5000)
    monitor.sample(11, 6000)
    expect(steps).toEqual([])
  })
})
