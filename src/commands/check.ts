import { join } from 'node:path'
import { describeDrift, findOrphans } from '@/configuration/drift'

import { coverageCounts, pathsByCheck } from '@/coverage/measure'
import { unreadReason } from '@/coverage/status'
import { judgeBaseline } from '@/run/baseline'
import { problemsOf } from '@/toolchain/presence'
import { stdoutOf } from '@/run/invoke'
import { buildGraph, waves } from '@/run/graph'

import { buildReport, buildSarif, describeRun } from '@/run/report'
import { findSuppressions } from '@/run/suppression'
import { verdictOf } from '@/run/verdict'
import type { Inspection } from 'types/manifest'
import { checksOf, configArgsOf, ruleSetsOf, sweepOf } from '@/settings/policy'
import { disablesCheck } from '@/settings/declaration'
import type { Exception } from 'types/settings'
import type { Check } from 'types/manifest'
import type { AppliedException } from 'types/run'
import type { DriftFinding } from 'types/configuration'
import type { BaselineVerdict, CheckResult, GraphNode, Suppression } from 'types/run'
import type { Policy } from 'types/settings'
import type { CheckOptions, CheckOutcome } from 'types/commands'
import type { Measurement } from 'types/measure'
import { findDrift } from '@/configuration/drift'
import { renderAll } from '@/configuration/write'

import { measure } from '@/coverage/measure'
import { baselineRefusedFor, readBaselines } from '@/run/baseline'
import { runCheck } from '@/run/execute'
import { invoke } from '@/run/invoke'
import { writeReport, writeSarif } from '@/run/report'
import { readPolicy } from '@/settings/policy'
import { readPresence } from '@/toolchain/presence'
import { readOrNull } from '@/detect/read'
import { optional } from '@/settings/optional'

export async function runChecks(options: CheckOptions): Promise<CheckOutcome> {
  const startedAt = new Date()
  const started = performance.now()
  const policy = await readPolicy(options.cwd, options.presetsRoot)
  const measurement = await measure(sweepOf(policy))

  if (options.unchecked) return { ...unreadOnly(measurement), verdict: { passed: true, reasons: [], failing: [] }, results: [] }

  const nodes = selectNodes(policy, options)
  const limit = await pathLimit(policy.root, options.since)
  const results = await runWaves(policy, nodes, measurement, { options, limit })
  const suppressions = await readSuppressions(policy, measurement)
  const drift = await driftFor(policy, options)
  const baselines = await baselinesFor(policy, results)
  const tools = problemsOf(await readPresence(policy.root, policy.presets))

  const verdict = verdictOf({
    results,
    coverage: coverageCounts(measurement),
    drift,
    baselines,
    suppressions,
    tools,
  })
  const report = buildReport({
    version: options.version,
    stage: options.stage ?? 'all',
    startedAt,
    durationMs: Math.round(performance.now() - started),
    verdict,
    results,
    coverage: coverageCounts(measurement),
    exceptions: appliedExceptions(policy, results),
    suppressions,
    baselines,
    loosenings: policy.merged.loosenings,
  })
  await writeReport(policy.root, report)
  await writeSarif(policy.root, buildSarif(report, options.version))
  const lines = [...drift.map(describeDrift), ...describeRun(report, verdict)]
  return { verdict, results, lines, code: verdict.passed ? 0 : 1 }
}

function appliedExceptions(policy: Policy, results: readonly CheckResult[]): readonly AppliedException[] {
  return policy.settings.exceptions.map((entry) => ({
    check: entry.check,
    reason: entry.reason,
    narrowedBy: narrowedBy(entry),
    covered: results
      .filter((result) => result.check === entry.check)
      .reduce((total, result) => total + (result.suppressed ?? 0), 0),
  }))
}

function narrowedBy(entry: Exception): readonly string[] {
  return [
    ...(entry.paths === undefined ? [] : [`paths ${entry.paths.patterns.join(' ')}`]),
    ...(entry.rule === undefined ? [] : [`rule ${entry.rule}`]),
    ...(entry.symbol === undefined ? [] : [`symbol ${entry.symbol}`]),
    ...(entry.finding === undefined ? [] : [`finding ${entry.finding}`]),
  ]
}

async function driftFor(policy: Policy, options: CheckOptions): Promise<readonly DriftFinding[]> {
  if (options.stage === 'commit-msg') return []
  const files = await renderAll({
    presets: policy.presets,
    settings: policy.merged.settings,
    version: options.version,
    stubs: new Set(),
  })
  return [
    ...(await findDrift(policy.root, files)),
    ...findOrphans(files, new Set(checksOf(policy).keys())),
  ]
}

async function baselinesFor(
  policy: Policy,
  results: readonly CheckResult[],
): Promise<readonly BaselineVerdict[]> {
  const baselines = await readBaselines(policy.root)
  const inspects = inspectionsByCheck(policy)
  const verdicts: BaselineVerdict[] = []
  for (const result of results) {
    const baseline = baselines.get(result.check)
    if (baseline === undefined) continue
    const refused = baselineRefusedFor(inspects.get(result.check) ?? [])
    if (refused !== null) {
      throw new Error(
        `${result.check} has a baseline and inspects \`${refused}\`.\n` +
          '  A declaration or one formatter run fixes that in a single commit, so a recorded\n' +
          '  backlog hides work nobody needs to schedule. Delete the baseline and fix the findings.',
      )
    }
    verdicts.push(judgeBaseline(baseline, result.findings, result.perPath ?? {}))
  }
  return verdicts
}

function inspectionsByCheck(policy: Policy): ReadonlyMap<string, readonly Inspection[]> {
  const inspects = new Map<string, readonly Inspection[]>()
  for (const preset of policy.presets) {
    for (const check of preset.checks) inspects.set(check.id, check.inspects)
  }
  for (const consumer of policy.settings.checks) {
    inspects.set(consumer.check.id, consumer.check.inspects)
  }
  return inspects
}

function selectNodes(policy: Policy, options: CheckOptions): readonly GraphNode[] {
  return buildGraph(policy.scopes, options.stage ?? null, policy.settings.checks)
    .filter((node) => options.scope === undefined || node.scope === options.scope)
    .map((node) => ({ ...node, checks: node.checks.filter((check) => wanted(check.id, check.inspects, options)) }))
    .filter((node) => node.checks.length > 0)
}

function wanted(id: string, inspects: readonly Inspection[], options: CheckOptions): boolean {
  if (options.only !== undefined && id !== options.only) return false
  if (options.inspects !== undefined && !inspects.includes(options.inspects)) return false
  return true
}

type RunContext = { readonly options: CheckOptions; readonly limit: ReadonlySet<string> | null }

async function runWaves(
  policy: Policy,
  nodes: readonly GraphNode[],
  measurement: Measurement,
  context: RunContext,
): Promise<readonly CheckResult[]> {
  const claimed = pathsByCheck(measurement)
  const ruleSets = ruleSetsOf(policy)
  const configArgs = configArgsOf(policy)
  const results: CheckResult[] = []
  const done = new Set<string>()

  const exceptions = policy.settings.exceptions

  for (const wave of waves(nodes)) {
    const running = wave.flatMap((node) =>
      node.checks
        .filter((check) => !done.has(`${check.id}@${node.scope}`))
        .filter((check) => !turnedOff(exceptions, check.id))
        .map(async (check) => {
          done.add(`${check.id}@${node.scope}`)
          const paths = narrow(claimed.get(check.id) ?? [], node.scope, context.limit)
          return await runCheck({
            root: policy.root,
            check,
            scope: node.scope,
            paths: allowed(paths, exceptions, check),
            configArgs: configArgs.get(check.id) ?? [],
            skipLocally: skipping(policy, context.options, check.id),
            ...optional('ruleSet', ruleSets.get(check.id)),
            limits: valuesOf(policy),
            entryPoints: measurement.tracked.paths.map((entry) => entry.path),
            exceptions,
          })
        }),
    )
    results.push(...(await Promise.all(running)))
  }
  return results
}

function turnedOff(exceptions: readonly Exception[], id: string): boolean {
  return exceptions.some((entry) => entry.check === id && disablesCheck(entry))
}

function allowed(
  paths: readonly string[],
  exceptions: readonly Exception[],
  check: Check,
): readonly string[] {
  const id = check.id
  const scoped = check.paths === undefined ? paths : paths.filter((path) => check.paths?.matches(path) === true)

  const removing = exceptions.filter(
    (entry) =>
      entry.check === id &&
      entry.paths !== undefined &&
      entry.rule === undefined &&
      entry.symbol === undefined &&
      entry.finding === undefined,
  )
  if (removing.length === 0) return scoped
  return scoped.filter((path) => !removing.some((entry) => entry.paths?.matches(path) === true))
}

function valuesOf(policy: Policy): ReadonlyMap<string, unknown> {
  return new Map([...policy.merged.settings].map(([name, setting]) => [name, setting.value]))
}

function skipping(policy: Policy, options: CheckOptions, id: string): boolean {
  return policy.localSkips.has(id) || options.skip.includes(id)
}

function narrow(
  paths: readonly string[],
  scope: string,
  limit: ReadonlySet<string> | null,
): readonly string[] {
  const inScope = scope === '' ? paths : paths.filter((path) => path.startsWith(`${scope}/`))
  return limit === null ? inScope : inScope.filter((path) => limit.has(path))
}

async function pathLimit(root: string, since: string | undefined): Promise<ReadonlySet<string> | null> {
  if (since === undefined) return null
  const changed = stdoutOf(
    await invoke({ command: ['git', 'diff', '--name-only', `${since}...HEAD`], cwd: root }),
    `git diff against ${since}`,
  )
  return new Set(changed.split('\n').filter((line) => line.length > 0))
}

async function readSuppressions(
  policy: Policy,
  measurement: Measurement,
): Promise<readonly Suppression[]> {
  const found: Suppression[] = []
  for (const status of measurement.statuses) {
    if (status.claims.length === 0) continue
    const contents = await readOrNull(join(policy.root, status.path))
    if (contents === null) continue
    found.push(...findSuppressions(status.path, contents))
  }
  return found
}

function unreadOnly(measurement: Measurement): { lines: readonly string[]; code: 0 | 1 } {
  const lines: string[] = []
  for (const status of measurement.statuses) {
    if (status.status !== 'unchecked') continue
    lines.push(status.path)
    lines.push(`  ${measurement.unread.get(status.path) ?? unreadReason(status)}`)
  }
  return { lines, code: lines.length === 0 ? 0 : 1 }
}
