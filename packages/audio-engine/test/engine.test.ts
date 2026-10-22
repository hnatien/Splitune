import { describe, expect, it } from 'vitest'
import { render } from './render.ts'
import { SAMPLE_RATE, scenarios } from './scenarios.ts'

describe('offline render through dsp.wasm (Node)', () => {
  for (const scenario of scenarios) {
    it(scenario.name, () => {
      const { left, events } = render(scenario.setup(), SAMPLE_RATE)
      scenario.check(scenario.measure(left, events), expect)
    })
  }
})
