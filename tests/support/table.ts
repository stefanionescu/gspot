import { buildTable } from '@/coverage/table'
import type { CoverageTable, PathStatus, Status } from 'types/coverage'
import type { Inspection } from 'types/manifest'

export function at(path: string, status: Status, missing: Inspection[] = []): PathStatus {
  return { path, status, claims: [], missing, unverified: false }
}

export function tableOf(statuses: PathStatus[]): CoverageTable {
  return buildTable({
    statuses,
    trackedFiles: statuses.length,
    submodules: 0,
    gspot: '0.1.0',
    at: new Date('2026-09-17T00:00:00Z'),
  })
}
