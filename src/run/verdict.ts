import { failsTheGate } from '@/run/execute'
import { unreasoned } from '@/run/suppression'
import type { DriftFinding } from 'types/configuration'
import type { BaselineVerdict, CheckResult, Suppression } from 'types/run'
import type { CoverageCounts } from 'types/coverage'
import type { ToolProblem, Verdict } from 'types/run'

export type VerdictInputs = {
  readonly results: readonly CheckResult[]
  readonly coverage: CoverageCounts
  readonly drift: readonly DriftFinding[]
  readonly baselines: readonly BaselineVerdict[]
  readonly suppressions: readonly Suppression[]
  readonly tools: readonly ToolProblem[]
}

export function verdictOf(inputs: VerdictInputs): Verdict {
  const reasons: string[] = []

  const held = new Set(
    inputs.baselines.filter((entry) => !entry.exceeded).map((entry) => entry.rule),
  )
  const withFindings = inputs.results.filter(
    (result) => result.status !== 'skipped' && failsTheGate(result) && !held.has(result.check),
  )
  const badSkips = inputs.results.filter(
    (result) => result.status === 'skipped' && result.platform !== true,
  )

  if (withFindings.length > 0) {
    reasons.push(`${withFindings.length} check(s) reported findings`)
  }
  for (const skip of badSkips) {
    reasons.push(`${skip.check} did not run: ${skip.reason ?? 'no reason given'}`)
  }
  reasons.push(...coverageReasons(inputs.coverage))
  reasons.push(...driftReasons(inputs.drift))

  const exceeded = inputs.baselines.filter((entry) => entry.exceeded)
  for (const entry of exceeded) {
    reasons.push(describeBaseline(entry))
  }
  const missing = unreasoned(inputs.suppressions)
  if (missing.length > 0) {
    reasons.push(`${missing.length} suppression(s) carry no reason`)
  }
  for (const tool of inputs.tools) {
    reasons.push(
      tool.why === 'missing'
        ? `${tool.tool} is in tools.lock and is not installed`
        : `${tool.tool} does not match the checksum in tools.lock`,
    )
  }

  return {
    passed: reasons.length === 0,
    reasons,
    failing: [...withFindings, ...badSkips].map((result) => result.check),
  }
}

function coverageReasons(counts: CoverageCounts): readonly string[] {
  const reasons: string[] = []
  if (counts.unchecked > 0) reasons.push(`${counts.unchecked} path(s) no check reads`)
  if (counts.partial > 0) reasons.push(`${counts.partial} path(s) covered only in part`)
  if (counts.orphan > 0) reasons.push(`${counts.orphan} generated file(s) nothing reads`)
  return reasons
}

function driftReasons(drift: readonly DriftFinding[]): readonly string[] {
  const reasons: string[] = []
  const edited = drift.filter((entry) => entry.kind === 'edited' || entry.kind === 'absent')
  const globs = drift.filter((entry) => entry.kind === 'empty-glob')
  const referents = drift.filter((entry) => entry.kind === 'missing-referent')
  if (edited.length > 0) reasons.push(`${edited.length} generated file(s) differ from their render`)
  if (globs.length > 0) reasons.push(`${globs.length} glob(s) match nothing`)
  if (referents.length > 0) reasons.push(`${referents.length} reference(s) name a missing file`)
  return reasons
}

function describeBaseline(entry: BaselineVerdict): string {
  if (entry.grew.length > 0) {
    return `${entry.rule} grew in ${entry.grew.join(', ')}, against a baseline of ${entry.baseline}`
  }
  return `${entry.rule} is at ${entry.count} against a baseline of ${entry.baseline}`
}
