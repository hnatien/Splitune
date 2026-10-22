import { Stems } from '@splitune/contracts'
import {
  assertWithin,
  EXAMPLES_PREFIX,
  GET_TTL_S,
  StorageKeyError,
  userPrefix,
} from '@splitune/storage'
import { apiError } from '../errors.ts'
import { type ApiDeps, authed } from '../procedures.ts'

const MAX_STEMS_JSON_BYTES = 1024 * 1024
const CONTAINER = { aac_mp4: 'mp4', opus_webm: 'webm' } as const

const invalid = (path: string, code: string) =>
  apiError('invalid_input', { details: { issues: [{ path, code }] } })

/**
 * Signed GET (15 min) for an artefact document, or with `stem_id` for one stem's audio file in
 * the requested codec variant (13 §4: the mixer loads stems as they land). Stem paths come from
 * stems.json, relative to its directory, and must stay inside `prefix` (the user's, or an
 * example build's for example songs).
 */
export async function signArtefact(
  deps: ApiDeps,
  artefact: { kind: string; objectKey: string },
  input: { stem_id?: string | undefined; variant?: keyof typeof CONTAINER | undefined },
  prefix: string,
) {
  let key = artefact.objectKey
  if (input.stem_id !== undefined) {
    if (artefact.kind !== 'stems') throw invalid('stem_id', 'not_a_stems_artefact')
    const bytes = await deps.storage.getBytes(key, { maxBytes: MAX_STEMS_JSON_BYTES })
    if (bytes === undefined) throw apiError('not_found')
    const stems = Stems.parse(JSON.parse(new TextDecoder().decode(bytes)))
    const stem = stems.stems.find((s) => s.stem_id === input.stem_id)
    const container = CONTAINER[input.variant ?? 'aac_mp4']
    const file = stem?.files.find((f) => f.container === container)
    if (file === undefined) throw apiError('not_found')
    try {
      key = assertWithin(prefix, `${key.slice(0, key.lastIndexOf('/') + 1)}${file.path}`)
    } catch (error) {
      if (error instanceof StorageKeyError) throw apiError('not_found')
      throw error
    }
  } else if (input.variant !== undefined) {
    throw invalid('variant', 'variant_needs_stem_id')
  }
  const expiresAt = new Date(Date.now() + GET_TTL_S * 1000)
  return { url: await deps.storage.presignGet(key), expires_at: expiresAt.toISOString() }
}

export const artefacts = {
  url: authed.artefacts.url.handler(async ({ context, input }) => {
    const { deps, userId } = context
    const artefact = await deps.repos.artefacts.get(userId, input.id)
    if (!artefact) throw apiError('not_found')
    // A claimed example song's artefacts are the shared example objects (03 "Example songs").
    const prefix = artefact.objectKey.startsWith(EXAMPLES_PREFIX)
      ? artefact.objectKey.slice(0, artefact.objectKey.lastIndexOf('/') + 1)
      : userPrefix(userId)
    return signArtefact(deps, artefact, input, prefix)
  }),
}
