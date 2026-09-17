import { detect } from '@/detect/propose'
import type { Preset } from 'types/manifest'
import type { ExistingTool, Reading } from 'types/detect'
import { readCandidates } from '@/coverage/candidate'
import { trackedFiles } from '@/coverage/tracked'
import { HOOK_RUNNER_PATTERN, RUNNER_SIGNALS, TOOL_CONFIGS } from '@config/detection'
import { AGENT_INDEX_FILES } from '@config/paths'
import { readManifests } from '@/detect/manifest'
import type { Runner } from 'types/settings'

export async function readRepository(
  root: string,
  available: ReadonlyMap<string, Preset>,
): Promise<Reading> {
  const tracked = await trackedFiles(root)
  const paths = tracked.paths.map((entry) => entry.path)
  const candidates = await readCandidates(root, tracked.paths)
  const manifests = await readManifests(root, paths)

  return {
    root,
    tracked,
    candidates,
    manifests,
    detection: detect({ tracked: paths, candidates, manifests, available }),
    runner: runnerIn(paths),
    hookRunner: hookRunnerIn(paths),
    ci: ciIn(paths),

    agentRules: paths.filter((path) => AGENT_INDEX_FILES.includes(path)),
    existingTools: toolsIn(paths),
  }
}

function runnerIn(paths: readonly string[]): Runner | null {
  const found = RUNNER_SIGNALS.find((signal) => paths.some((path) => signal.pattern.test(path)))
  return found === undefined ? null : found.runner
}

function hookRunnerIn(paths: readonly string[]): string | null {
  const found = paths.find((path) => HOOK_RUNNER_PATTERN.test(path))
  return found === undefined ? null : found.slice(0, found.indexOf('/'))
}

function ciIn(paths: readonly string[]): string | null {
  return (
    paths.find((path) => path.startsWith('.github/workflows/')) ??
    paths.find((path) => path === '.gitlab-ci.yml' || path.startsWith('.buildkite/')) ??
    null
  )
}

function toolsIn(paths: readonly string[]): readonly ExistingTool[] {
  const found: ExistingTool[] = []
  for (const entry of TOOL_CONFIGS) {
    const config = paths.find((path) => entry.pattern.test(path))
    if (config === undefined) continue
    found.push({ tool: entry.tool, config, ownable: entry.ownable })
  }
  return found
}

export function describeReading(reading: Reading): readonly string[] {
  const lines = [`reading ${reading.tracked.paths.length} tracked files`, '']
  const languages = reading.detection.proposals
    .filter((proposal) => proposal.preset.startsWith('language:'))
    .map((proposal) => `${proposal.preset.slice('language:'.length)} ${proposal.evidence}`)
  lines.push(`languages        ${languages.join('   ') || 'none found'}`)

  const frameworks = reading.detection.proposals.filter(
    (proposal) => !proposal.preset.startsWith('language:'),
  )
  for (const [index, proposal] of frameworks.entries()) {
    const label = index === 0 ? 'frameworks      ' : '                '
    lines.push(`${label} ${proposal.preset.padEnd(24)} ${proposal.evidence}`)
  }
  lines.push(`projects         ${reading.manifests.length} manifest(s): ${manifestList(reading)}`)
  lines.push(`runner           ${reading.runner ?? 'none found'}`)
  lines.push(`hooks            ${reading.hookRunner ?? 'none found'}`)
  lines.push(`ci               ${reading.ci ?? 'none found'}`)
  lines.push(`agent rules      ${reading.agentRules.join(', ') || 'none found'}`)
  lines.push('')
  lines.push(`already linting  ${reading.existingTools.map((entry) => entry.tool).join(', ') || 'nothing'}`)
  return lines
}

function manifestList(reading: Reading): string {
  return reading.manifests.map((manifest) => `./${manifest.path}`).join(', ') || 'none'
}
