import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Stage } from 'types/manifest'
import { countByForm } from '@/run/suppression'
import type { CoverageCounts } from 'types/coverage'
import type { Loosening } from 'types/settings'
import type { AppliedException, BaselineVerdict, CheckResult, Suppression, Verdict } from 'types/run'
import { LATEST_RUN_PATH, LATEST_SARIF_PATH, RUN_DIRECTORY } from '@config/paths'
import type { RunReport } from 'types/run'

export type ReportInputs = {
  readonly version: string
  readonly stage: Stage | 'all'
  readonly startedAt: Date
  readonly durationMs: number
  readonly verdict: Verdict
  readonly results: readonly CheckResult[]
  readonly coverage: CoverageCounts
  readonly exceptions: readonly AppliedException[]
  readonly suppressions: readonly Suppression[]
  readonly baselines: readonly BaselineVerdict[]
  readonly loosenings: readonly Loosening[]
}

export function buildReport(inputs: ReportInputs): RunReport {
  return {
    gspot: inputs.version,
    stage: inputs.stage,
    startedAt: inputs.startedAt.toISOString(),
    durationMs: inputs.durationMs,
    verdict: inputs.verdict.passed ? 'passed' : 'failed',
    checks: inputs.results,
    coverage: inputs.coverage,
    exceptions: inputs.exceptions,
    suppressions: Object.fromEntries(countByForm(inputs.suppressions)),
    baselines: inputs.baselines,
    loosenings: inputs.loosenings,
  }
}

export async function writeReport(root: string, report: RunReport): Promise<void> {
  const directory = join(root, RUN_DIRECTORY)
  await mkdir(directory, { recursive: true })
  const body = `${JSON.stringify(report, null, 2)}\n`
  const stamp = report.startedAt.replace(/[:.]/gu, '-')
  await writeFile(join(directory, `${stamp}.json`), body, 'utf8')
  await writeFile(join(root, LATEST_RUN_PATH), body, 'utf8')
}

export async function readLatest(root: string): Promise<RunReport | null> {
  try {
    return JSON.parse(await readFile(join(root, LATEST_RUN_PATH), 'utf8')) as RunReport
  } catch (reason) {
    if ((reason as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw reason
  }
}

export function describeRun(report: RunReport, verdict: Verdict): readonly string[] {
  const lines = report.checks.map(describeCheck)
  const { unchecked, partial, orphan } = report.coverage
  lines.push('')
  lines.push(`coverage     ${unchecked} unchecked   ${partial} partial   ${orphan} orphan`)
  lines.push(...describeExceptions(report.exceptions))
  if (verdict.passed) return lines

  lines.push('')
  for (const reason of verdict.reasons) lines.push(`why          ${reason}`)
  if (verdict.failing.length > 0) {
    lines.push(`failed: ${[...new Set(verdict.failing)].join(', ')}`)
    lines.push(`reproduce: ${reproduce(report.checks, verdict.failing[0] as string)}`)
  }
  return lines
}

export function describeExceptions(exceptions: readonly AppliedException[]): readonly string[] {
  if (exceptions.length === 0) return ['exceptions   0']
  const lines = [`exceptions   ${exceptions.length}`]
  for (const entry of exceptions) {
    const narrowed = entry.narrowedBy.length === 0 ? 'the whole check' : entry.narrowedBy.join(', ')
    const covered = entry.covered === 0 ? 'covered nothing this run' : `covered ${entry.covered}`
    lines.push(`             ${entry.check}  ${narrowed}  ${covered}`)
    lines.push(`               ${entry.reason}`)
  }
  return lines
}

function describeCheck(result: CheckResult): string {
  const scope = (result.scope === '' ? '.' : result.scope).padEnd(12)
  const name = result.check.padEnd(20)
  if (result.status === 'skipped') return `${scope} ${name} SKIP    ${result.reason}`
  const state = result.findings > 0 ? 'FAIL' : result.status === 'cached' ? 'cache' : 'ok'
  const seconds = `${(result.durationMs / 1000).toFixed(1)}s`
  return `${scope} ${name} ${state.padEnd(7)} ${String(result.pathsRead).padStart(5)} files  ${seconds}`
}

export function reproduce(results: readonly CheckResult[], check: string): string {
  const found = results.find((result) => result.check === check)
  const scope = found === undefined || found.scope === '' ? '' : ` --scope ${found.scope}`
  return `gspot check ${check}${scope}`
}

export function buildSarif(report: RunReport, version: string): unknown {
  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: { driver: { name: 'gspot', version, informationUri: 'https://example.invalid/gspot' } },
        results: report.checks
          .filter((check) => check.findings > 0)
          .map((check) => ({
            ruleId: check.check,
            level: 'error',
            message: { text: check.brokeBecause ?? `${check.findings} finding(s)` },
            locations: [],
          })),
      },
    ],
  }
}

export async function writeSarif(root: string, sarif: unknown): Promise<void> {
  await mkdir(join(root, RUN_DIRECTORY), { recursive: true })
  await writeFile(join(root, LATEST_SARIF_PATH), `${JSON.stringify(sarif, null, 2)}\n`, 'utf8')
}
