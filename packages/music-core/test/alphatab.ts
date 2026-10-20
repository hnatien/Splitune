import * as alphaTab from '@coderline/alphatab'

// Loads alphaTex with the alphaTab 1.8 importer and collects every diagnostic (hints included).
export function loadAlphaTex(tex: string): { score: alphaTab.model.Score; diagnostics: string[] } {
  const importer = new alphaTab.importer.AlphaTexImporter()
  importer.logErrors = false
  importer.initFromString(tex, new alphaTab.Settings())
  let score: alphaTab.model.Score | undefined
  let failure: unknown
  try {
    score = importer.readScore()
  } catch (error) {
    failure = error
  }
  const diagnostics = [
    importer.lexerDiagnostics,
    importer.parserDiagnostics,
    importer.semanticDiagnostics,
  ].flatMap((bag) => bag.items.map((d) => `${d.severity}: ${d.message}`))
  if (score === undefined)
    throw new Error(`alphaTex rejected: ${diagnostics.join('; ')} ${String(failure)}`)
  return { score, diagnostics }
}

// Every bar's beats add up to its time signature (anacrusis bars excepted).
export function barDurationMismatches(score: alphaTab.model.Score): number[] {
  const staff = score.tracks[0]?.staves[0]
  if (staff === undefined) return []
  return staff.bars.flatMap((bar, i) => {
    const master = score.masterBars[i]
    if (master === undefined || master.isAnacrusis) return []
    const total = (bar.voices[0]?.beats ?? []).reduce((sum, beat) => sum + beat.playbackDuration, 0)
    return total === master.calculateDuration() ? [] : [i]
  })
}
