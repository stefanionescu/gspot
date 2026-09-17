import { coverageCounts } from '@/coverage/measure'

import type { Preset } from 'types/manifest'
import { select } from '@/settings/selection'
import type { Policy } from 'types/settings'
import type { UpgradeOptions, UpgradeOutcome } from 'types/commands'

import { measure } from '@/coverage/measure'
import { repositoryRoot } from '@/coverage/tracked'
import { readPolicy, sweepOf } from '@/settings/policy'
import { readPresets } from '@/settings/selection'
import { COVERAGE_DELTA_SAMPLE } from '@config/limits'

export async function runUpgrade(options: UpgradeOptions): Promise<UpgradeOutcome> {
  const root = await repositoryRoot(options.cwd)
  const policy = await readPolicy(root, options.presetsRoot)
  if (options.against === undefined) {
    return { lines: [howToMove(policy, options)], aborted: false, code: 0 }
  }

  const target = await targetPresets(policy, options.against)
  const lines = [`gspot ${options.version} -> ${options.to ?? 'next'}`, '']
  lines.push(...checkSection(policy.presets, target))
  lines.push(...toolSection(policy.presets, target))

  const delta = await coverageDelta(policy, target)
  lines.push(...delta.lines)
  if (delta.lost > 0) {
    lines.push('', 'aborted: this version claims fewer paths than the one installed.')
    return { lines, aborted: true, code: 1 }
  }
  if (!options.check) lines.push('', 'run `gspot generate` to re-render, then commit the result.')
  return { lines, aborted: false, code: 0 }
}

function howToMove(policy: Policy, options: UpgradeOptions): string {
  const target = options.to ?? 'latest'
  const command =
    policy.settings.runner === 'mise'
      ? `mise use npm:gspot@${target}`
      : `${policy.settings.runner} add -d gspot@${target}`
  return (
    `to move version: ${command}\n` +
    '  Then run `gspot upgrade --check` to see what changes, and `gspot generate` to take it.\n' +
    '  Bumping the version alone leaves every generated file stale, and the next\n' +
    '  `gspot generate --check` fails on it. gspot does not commit; a person does.'
  )
}

async function targetPresets(policy: Policy, against: string): Promise<readonly Preset[]> {
  const available = await readPresets(against)
  return select(available, policy.settings.presets, `${against} (the version being moved to)`).presets
}

function checkSection(current: readonly Preset[], target: readonly Preset[]): readonly string[] {
  const here = new Set(current.flatMap((preset) => preset.checks.map((check) => check.id)))
  const there = new Set(target.flatMap((preset) => preset.checks.map((check) => check.id)))
  const lines = ['rules']
  for (const id of [...there].filter((check) => !here.has(check)).sort()) {
    lines.push(`  + ${id.padEnd(32)} new`)
  }
  for (const id of [...here].filter((check) => !there.has(check)).sort()) {
    lines.push(`  - ${id.padEnd(32)} removed`)
  }
  if (lines.length === 1) lines.push('  no change')
  return [...lines, '']
}

function toolSection(current: readonly Preset[], target: readonly Preset[]): readonly string[] {
  const here = new Map(current.flatMap((preset) => preset.tools.map((tool) => [tool.id, tool.version])))
  const there = new Map(target.flatMap((preset) => preset.tools.map((tool) => [tool.id, tool.version])))
  const lines = ['tools']
  for (const [id, version] of [...there].sort()) {
    const was = here.get(id)
    if (was === undefined) lines.push(`  + ${id.padEnd(24)} ${version}   new`)
    else if (was !== version) lines.push(`  ~ ${id.padEnd(24)} ${was} -> ${version}`)
  }
  for (const id of [...here.keys()].filter((tool) => !there.has(tool)).sort()) {
    lines.push(`  - ${id.padEnd(24)} removed`)
  }
  if (lines.length === 1) lines.push('  no change')
  return [...lines, '']
}

async function coverageDelta(
  policy: Policy,
  target: readonly Preset[],
): Promise<{ readonly lines: readonly string[]; readonly lost: number }> {
  const before = await measure(sweepOf(policy))
  const after = await measure({ ...sweepOf(policy), scopes: [{ path: '', presets: target }] })
  const was = claimedPaths(before)
  const now = claimedPaths(after)
  const gained = [...now].filter((path) => !was.has(path))
  const lost = [...was].filter((path) => !now.has(path))
  return {
    lines: [
      'coverage change',
      `  + ${gained.length} path(s) newly claimed`,
      `  - ${lost.length} path(s) lose coverage`,
      ...lost.slice(0, COVERAGE_DELTA_SAMPLE).map((path) => `      ${path}`),
      `  now ${JSON.stringify(coverageCounts(after))}`,
    ],
    lost: lost.length,
  }
}

function claimedPaths(measurement: Awaited<ReturnType<typeof measure>>): ReadonlySet<string> {
  return new Set(
    measurement.statuses.filter((status) => status.claims.length > 0).map((status) => status.path),
  )
}
