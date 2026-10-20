import { z } from 'zod'
import { contracts } from '../registry.ts'

// services/ml/config/calibration/{model_id}@{version}.json: written by the eval harness, read by the
// Python stages (calibrate once) and by music-core (re-banding on the client).
export const CalibrationTable = z
  .object({
    model_id: z.string().min(1),
    version: z.string().min(1),
    method: z.enum(['isotonic', 'identity']),
    // (raw, calibrated) knots sorted by raw with non-decreasing calibrated values; linear
    // interpolation between knots, clamped outside. Ignored for `identity`.
    knots: z.array(z.tuple([z.number(), z.number().min(0).max(1)])),
    // Calibrated thresholds: confidence >= high → high, >= medium → medium, otherwise low.
    bands: z.object({ high: z.number().min(0).max(1), medium: z.number().min(0).max(1) }),
    fitted_on: z.string().optional(), // test-set id the table was fitted on
  })
  .register(contracts, { id: 'CalibrationTable' })
