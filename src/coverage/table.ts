import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { STATUSES } from 'types/coverage'
import type { PathStatus, Status } from 'types/coverage'
import { COVERAGE_PATH } from '@config/paths'
import { COVERAGE_TABLE_VERSION } from '@config/versions'
import { FAILING_STATUSES } from 'types/coverage'
import type { CoverageRow, CoverageTable, Regression } from 'types/coverage'

export type TableInputs = {
  readonly statuses: readonly PathStatus[]
  readonly trackedFiles: number
  readonly submodules: number
  readonly gspot: string
  readonly at: Date
}

export function buildTable(inputs: TableInputs): CoverageTable {
  const summary = Object.fromEntries(STATUSES.map((status) => [status, 0])) as Record<Status, number>
  const paths: Record<string, CoverageRow> = {}

  for (const entry of [...inputs.statuses].sort((left, right) => (left.path < right.path ? -1 : 1))) {
    summary[entry.status] += 1
    paths[entry.path] = {
      status: entry.status,
      checks: entry.claims.map((claim) => ({
        check: claim.check,
        inspects: [...claim.inspects],
        fileList: claim.via,
      })),
      ...(entry.missing.length === 0 ? {} : { missing: [...entry.missing] }),
      ...(entry.reason === undefined ? {} : { reason: entry.reason }),
      ...(entry.unverified ? { unverified: true } : {}),
    }
  }

  return {
    version: COVERAGE_TABLE_VERSION,
    generatedAt: inputs.at.toISOString(),
    gspot: inputs.gspot,
    trackedFiles: inputs.trackedFiles,
    submodules: inputs.submodules,
    summary,
    paths,
  }
}

export function failingCount(table: CoverageTable): number {
  return FAILING_STATUSES.reduce((total, status) => total + table.summary[status], 0)
}

export async function writeTable(root: string, table: CoverageTable): Promise<void> {
  const target = join(root, COVERAGE_PATH)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, `${JSON.stringify(table, null, 2)}\n`, 'utf8')
}

export async function readTable(root: string): Promise<CoverageTable | null> {
  try {
    return JSON.parse(await readFile(join(root, COVERAGE_PATH), 'utf8')) as CoverageTable
  } catch (reason) {
    if ((reason as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw reason
  }
}

export function regressions(previous: CoverageTable, current: CoverageTable): readonly Regression[] {
  const found: Regression[] = []
  for (const [path, row] of Object.entries(current.paths)) {
    if (!FAILING_STATUSES.includes(row.status)) continue
    const before = previous.paths[path]?.status
    if (before !== undefined && FAILING_STATUSES.includes(before)) continue
    found.push({ path, was: before ?? 'absent', now: row.status })
  }
  return found
}
