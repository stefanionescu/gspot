import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { RunReport } from 'types/run'
import { LATEST_SARIF_PATH } from '@config/paths'
import type { Lines, ReportOptions } from 'types/commands'
import { repositoryRoot } from '@/coverage/tracked'

import { describeExceptions, readLatest, reproduce } from '@/run/report'

export async function runReport(options: ReportOptions): Promise<Lines> {
  const root = await repositoryRoot(options.cwd)
  const report = await readLatest(root)
  if (report === null) {
    return { lines: ['no run recorded yet. Run `gspot check` first.'], code: 1 }
  }
  if (options.sarif) return { lines: [await readSarif(root)], code: 0 }
  if (options.json) return { lines: [JSON.stringify(report, null, 2)], code: 0 }
  const lines = options.failed ? failuresIn(report) : summaryOf(report)
  return { lines, code: report.verdict === 'passed' ? 0 : 1 }
}

function failuresIn(report: RunReport): readonly string[] {
  const failing = report.checks.filter(
    (check) => check.findings > 0 || (check.status === 'skipped' && check.platform !== true),
  )
  if (failing.length === 0) return ['nothing failed in the last run.']
  return failing.flatMap((check) => [
    `${check.check}   ${check.reason ?? `${check.findings} finding(s)`}`,
    `  reproduce: ${reproduce(report.checks, check.check)}`,
    ...(check.brokeBecause === undefined ? [] : [`  ${check.brokeBecause.trim()}`]),
    ...(check.output === undefined ? [] : indent(check.output)),
  ])
}

function indent(output: string): readonly string[] {
  return output
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => `  | ${line}`)
}

function summaryOf(report: RunReport): readonly string[] {
  const lines = [
    `run          ${report.startedAt}   stage ${report.stage}   ${report.verdict}`,
    `checks       ${report.checks.length}`,
    `coverage     ${report.coverage.unchecked} unchecked   ${report.coverage.partial} partial   ` +
      `${report.coverage.orphan} orphan`,
    ...describeExceptions(report.exceptions),
  ]
  for (const baseline of report.baselines) {
    lines.push(`baseline     ${baseline.rule.padEnd(32)} ${baseline.count} of ${baseline.baseline}`)
  }

  for (const loosening of report.loosenings) {
    lines.push(`loosened     ${loosening.name.padEnd(32)} ${loosening.reason}`)
  }
  return lines
}

async function readSarif(root: string): Promise<string> {
  try {
    return await readFile(join(root, LATEST_SARIF_PATH), 'utf8')
  } catch {
    return '{}'
  }
}
