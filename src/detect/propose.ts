import { SIGNALS } from '@config/detection'
import { claims } from '@/coverage/candidate'
import type { Preset } from 'types/manifest'
import { extensionCounts } from '@/detect/extension'
import type { Candidate } from 'types/coverage'
import type { Manifest } from 'types/detect'
import type { Detection, Proposal } from 'types/detect'

export type DetectInputs = {
  readonly tracked: readonly string[]
  readonly candidates: readonly Candidate[]
  readonly manifests: readonly Manifest[]
  readonly available: ReadonlyMap<string, Preset>
}

type Sighting = { readonly scope: string; readonly evidence: string }

export function detect(inputs: DetectInputs): Detection {
  const proposals: Proposal[] = []
  for (const signal of SIGNALS) {
    const sightings =
      signal.kind === 'dependency' ? byDependency(inputs, signal.names) : byFile(inputs, signal.pattern)
    for (const found of sightings) {
      for (const preset of signal.presets) {
        if (!inputs.available.has(preset)) continue
        proposals.push({ preset, evidence: found.evidence, scope: found.scope })
      }
    }
  }
  proposals.push(...byExtension(inputs))

  const chosen = new Set(proposals.map((proposal) => proposal.preset))
  return {
    proposals: deduplicate(proposals),
    extensions: extensionCounts(inputs.candidates.map((candidate) => ({ path: candidate.path, gitMode: 'file' as const }))),
    unclaimed: unclaimedExtensions(inputs, chosen),
    scopes: scopesOf(inputs.manifests),
  }
}

function byExtension(inputs: DetectInputs): readonly Proposal[] {
  const proposals: Proposal[] = []
  for (const preset of inputs.available.values()) {
    if (preset.kind !== 'language') continue
    const matched = inputs.candidates.filter((candidate) => claims(preset, candidate))
    if (matched.length === 0) continue
    proposals.push({
      preset: preset.id,
      evidence: `${matched.length} tracked file(s)`,
      scope: '',
    })
  }
  return proposals
}

function unclaimedExtensions(
  inputs: DetectInputs,
  chosen: ReadonlySet<string>,
): readonly { extension: string; count: number }[] {
  const presets = [...chosen].map((id) => inputs.available.get(id) as Preset)
  const unclaimed = new Map<string, number>()
  for (const candidate of inputs.candidates) {
    if (presets.some((preset) => claims(preset, candidate))) continue
    const key = candidate.extension === '' ? '(no extension)' : candidate.extension
    unclaimed.set(key, (unclaimed.get(key) ?? 0) + 1)
  }
  return [...unclaimed]
    .map(([extension, count]) => ({ extension, count }))
    .sort((left, right) => right.count - left.count)
}

function scopesOf(manifests: readonly Manifest[]): readonly string[] {
  return [...new Set(manifests.map((manifest) => manifest.directory))]
    .filter((directory) => directory !== '')
    .sort()
}

function byDependency(inputs: DetectInputs, names: readonly string[]): readonly Sighting[] {
  return inputs.manifests
    .filter((manifest) => manifest.dependencies.some((found) => names.includes(found)))
    .map((manifest) => ({
      scope: manifest.directory,
      evidence: `${manifest.path}: ${names.filter((name) => manifest.dependencies.includes(name)).join(', ')}`,
    }))
}

function byFile(inputs: DetectInputs, pattern: RegExp): readonly Sighting[] {
  return inputs.tracked
    .filter((path) => pattern.test(path))
    .slice(0, 1)
    .map((path) => ({ scope: '', evidence: path }))
}

function deduplicate(proposals: readonly Proposal[]): readonly Proposal[] {
  const seen = new Map<string, Proposal>()
  for (const proposal of proposals) {
    const key = `${proposal.preset}@${proposal.scope}`
    if (!seen.has(key)) seen.set(key, proposal)
  }
  return [...seen.values()].sort((left, right) => (left.preset < right.preset ? -1 : 1))
}

