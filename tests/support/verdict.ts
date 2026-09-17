import type { CheckResult } from 'types/run'
import type { VerdictInputs } from '@/run/verdict'

export const NOTHING_HELD: VerdictInputs = {
  results: [],
  coverage: { unchecked: 0, partial: 0, orphan: 0 },
  drift: [],
  baselines: [],
  suppressions: [],
  tools: [],
}

export function ran(check: string, findings: number): CheckResult {
  return { check, scope: '', status: 'ran', findings, pathsRead: 1, durationMs: 1 }
}

export function skipped(check: string, platform: boolean): CheckResult {
  return {
    check,
    scope: '',
    status: 'skipped',
    findings: 0,
    pathsRead: 1,
    durationMs: 0,
    reason: platform ? 'linux only' : 'docker daemon unavailable',
    platform,
  }
}
