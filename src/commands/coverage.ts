import { buildTable, failingCount, regressions } from '@/coverage/table'

import type { CoverageTable, PathStatus } from 'types/coverage'
import { FAILING_STATUSES } from 'types/coverage'
import type { CoverageOptions, CoverageOutcome } from 'types/commands'
import type { Measurement } from 'types/measure'
import { measure } from '@/coverage/measure'
import { readTable, writeTable } from '@/coverage/table'
import { unreadReason } from '@/coverage/status'

import { readPolicy, sweepOf } from '@/settings/policy'

export async function runCoverage(options: CoverageOptions): Promise<CoverageOutcome> {
  const policy = await readPolicy(options.cwd, options.presetsRoot)
  const root = policy.root
  const measurement = await measure(sweepOf(policy))

  const table = buildTable({
    statuses: measurement.statuses,
    trackedFiles: measurement.tracked.paths.length,
    submodules: measurement.tracked.submodules.length,
    gspot: options.version,
    at: new Date(),
  })

  if (options.diff) return await reportDiff(root, table, measurement)
  await writeTable(root, table)
  return { table, measurement, lines: report(table, measurement), code: verdict(table, measurement) }
}

async function reportDiff(
  root: string,
  table: CoverageTable,
  measurement: Measurement,
): Promise<CoverageOutcome> {
  const previous = await readTable(root)
  if (previous === null) {
    const lines = ['coverage     no tracked table yet. Run `gspot coverage` to write one.']
    return { table, measurement, lines, code: 1 }
  }
  const lost = regressions(previous, table)
  if (lost.length === 0) {
    return { table, measurement, lines: [summary(table)], code: 0 }
  }
  const lines = lost.map((entry) => `lost         ${entry.path}   ${entry.was} -> ${entry.now}`)
  return { table, measurement, lines: [...lines, summary(table)], code: 1 }
}

function verdict(table: CoverageTable, measurement: Measurement): 0 | 1 {
  const broken = measurement.failures.length > 0 || measurement.untracked.length > 0
  return failingCount(table) > 0 || broken ? 1 : 0
}

function report(table: CoverageTable, measurement: Measurement): readonly string[] {
  const lines: string[] = []
  for (const entry of measurement.statuses) {
    if (!FAILING_STATUSES.includes(entry.status)) continue
    lines.push(...explain(entry, measurement))
  }
  for (const failure of measurement.failures) {
    lines.push(`broken       ${failure.check}   ${failure.reason}`)
  }
  for (const path of measurement.untracked) {
    lines.push(`untracked    ${path}   a tool read a path this repository does not track`)
  }
  lines.push(summary(table))
  return lines
}

function explain(entry: PathStatus, measurement: Measurement): readonly string[] {
  const head = `${entry.status.padEnd(12)} ${entry.path}`
  const why = measurement.unread.get(entry.path)
  if (why !== undefined) {
    return [head, `             ${why}`, '             remove the pattern, or declare the path in gspot.toml']
  }
  if (entry.missing.length > 0) {
    return [head, `             missing ${entry.missing.join(', ')}`]
  }
  return [head, `             ${unreadReason(entry)}`]
}

function summary(table: CoverageTable): string {
  const { summary: counts, trackedFiles } = table
  return (
    `coverage     ${trackedFiles} paths   ${counts.unchecked} unchecked   ` +
    `${counts.partial} partial   ${counts.orphan} orphan`
  )
}
