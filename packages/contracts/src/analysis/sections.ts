import { z } from 'zod'
import { contracts } from '../registry.ts'
import { ArtefactHeader } from './common.ts'

export const SectionLabel = z
  .enum([
    'intro',
    'verse',
    'prechorus',
    'chorus',
    'bridge',
    'solo',
    'inst',
    'outro',
    'break',
    'unknown',
  ])
  .register(contracts, { id: 'SectionLabel' })

export const SectionSegment = z
  .object({
    id: z.string().min(1),
    t0: z.number().nonnegative(),
    t1: z.number().nonnegative(),
    label: SectionLabel,
    boundary_confidence: z.number().min(0).max(1),
  })
  .register(contracts, { id: 'SectionSegment' })

export const Sections = ArtefactHeader.extend({
  artefact: z.literal('sections'),
  segments: z.array(SectionSegment),
}).register(contracts, { id: 'Sections' })
