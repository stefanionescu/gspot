import { extensionOf, filenameOf } from '@/detect/extension'

import type { Preset } from 'types/manifest'
import type { TrackedPath } from 'types/coverage'
import type { Candidate, CandidateSet } from 'types/coverage'

import { interpreterIn } from '@/detect/interpreter'

export async function readCandidates(
  root: string,
  paths: readonly TrackedPath[],
): Promise<readonly Candidate[]> {
  const candidates: Candidate[] = []
  for (const entry of paths) {
    const extension = extensionOf(entry.path)
    const interpreter = extension === '' ? await interpreterIn(root, entry.path) : null
    candidates.push({ path: entry.path, extension, interpreter })
  }
  return candidates
}

export function claimCandidates(
  candidates: readonly Candidate[],
  presets: readonly Preset[],
): CandidateSet {
  const claimed = new Map<string, string[]>()
  const unclaimed: string[] = []
  for (const preset of presets) claimed.set(preset.id, [])

  for (const candidate of candidates) {
    let anyone = false
    for (const preset of presets) {
      if (!claims(preset, candidate)) continue
      claimed.get(preset.id)?.push(candidate.path)
      anyone = true
    }
    if (!anyone) unclaimed.push(candidate.path)
  }
  return { candidates, claimed, unclaimed }
}

export function claims(preset: Preset, candidate: Candidate): boolean {
  if (candidate.extension !== '' && preset.claims.extensions.includes(candidate.extension)) {
    return true
  }
  if (preset.claims.filenames.includes(filenameOf(candidate.path))) return true
  return candidate.interpreter !== null && preset.claims.interpreters.includes(candidate.interpreter)
}

export function requiredFor(preset: Preset, candidate: Candidate): readonly string[] | undefined {
  return (
    preset.required.get(filenameOf(candidate.path)) ??
    preset.required.get(candidate.extension) ??
    requirementOfFirstExtension(preset, candidate)
  )
}

function requirementOfFirstExtension(preset: Preset, candidate: Candidate): readonly string[] | undefined {
  if (candidate.interpreter === null) return undefined
  if (!preset.claims.interpreters.includes(candidate.interpreter)) return undefined
  const first = preset.claims.extensions[0]
  return first === undefined ? undefined : preset.required.get(first)
}
