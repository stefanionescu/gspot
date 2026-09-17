import { detect } from '@/detect/propose'

import { describePresence, gatesOf } from '@/toolchain/presence'
import type { DoctorOptions, Lines } from 'types/commands'

import { readCandidates } from '@/coverage/candidate'
import { repositoryRoot, trackedFiles } from '@/coverage/tracked'
import { readManifests } from '@/detect/manifest'
import { hooksPath } from '@/runner/hooks'
import { readPolicy } from '@/settings/policy'
import { readPresets } from '@/settings/selection'
import { readPresence } from '@/toolchain/presence'

export async function runDoctor(options: DoctorOptions): Promise<Lines> {
  const root = await repositoryRoot(options.cwd)
  const policy = await readPolicy(root, options.presetsRoot)
  const available = await readPresets(options.presetsRoot)

  const presence = await readPresence(root, policy.presets)
  const lines: string[] = []
  for (const entry of presence) {
    lines.push(...describePresence(entry, 0))
  }

  const tracked = await trackedFiles(root)
  const paths = tracked.paths.map((entry) => entry.path)
  const found = detect({
    tracked: paths,
    candidates: await readCandidates(root, tracked.paths),
    manifests: await readManifests(root, paths),
    available,
  })

  const selected = new Set(policy.presets.map((preset) => preset.id))
  const unselected = found.proposals.filter((proposal) => !selected.has(proposal.preset))
  for (const proposal of unselected) {
    lines.push(`preset    ${proposal.preset.padEnd(28)} detected, not selected: ${proposal.evidence}`)
  }
  for (const entry of found.unclaimed) {
    lines.push(`unclaimed ${entry.extension.padEnd(28)} ${entry.count} file(s), no preset reads them`)
  }

  const hooks = await hooksPath(root)
  lines.push(`hooks     ${hooks ?? 'not installed'}`)

  const missing = presence.filter((entry) => !entry.present && gatesOf(policy.presets, entry.tool.id).length > 0)
  return { lines, code: missing.length === 0 && found.unclaimed.length === 0 ? 0 : 1 }
}
