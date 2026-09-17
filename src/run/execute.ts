import type { Check } from 'types/manifest'
import type { Answer, CheckResult, Skip } from 'types/run'
import { describe as describeAnswer, invoke } from '@/run/invoke'
import { skipReasonFor } from '@/run/skip'
import { runBuiltin } from '@/structure/builtin'
import { describeFinding, runStructure, type ResolvedCount } from '@/structure/engine'
import type { StructureFinding, StructureOutcome } from 'types/structure'
import { exceptionFor } from '@/settings/declaration'
import type { Exception, Suppressible } from 'types/settings'
import { describeParseFailure } from '@/structure/grammar'
import { readRules } from '@/structure/rules'

export type RunRequest = {
  readonly root: string
  readonly check: Check
  readonly scope: string
  readonly paths: readonly string[]
  readonly configArgs: readonly string[]
  readonly skipLocally: boolean
  readonly ruleSet?: string
  readonly limits?: ReadonlyMap<string, unknown>

  readonly entryPoints?: readonly string[]
  readonly exceptions?: readonly Exception[]
}

export async function runCheck(request: RunRequest): Promise<CheckResult> {
  const { check, scope } = request
  if (request.skipLocally) {
    return skipped(request, { reason: 'skipped in gspot.local.toml', platform: false })
  }
  const skip = await skipReasonFor(check.skipWhen, request.root)
  if (skip !== null) return skipped(request, skip)
  if (check.rules !== undefined || check.builtin !== undefined) return await runInProcess(request)

  const started = performance.now()
  const answers = await invokeCheck(request)
  const duration = Math.round(performance.now() - started)
  const missing = answers.find((answer) => answer.outcome === 'missing')
  if (missing !== undefined) {
    return skipped(request, { reason: describeAnswer(missing), platform: false })
  }

  const output = answers.map(textOf).join('')
  const broke = brokenBy(check, output)
  if (broke !== null) {
    return {
      check: check.id,
      scope,
      status: 'ran',
      findings: 1,
      pathsRead: request.paths.length,
      durationMs: duration,
      output,
      brokeBecause: broke,
    }
  }
  return {
    check: check.id,
    scope,
    status: 'ran',
    findings: countFindings(check, answers, output),
    pathsRead: request.paths.length,
    durationMs: duration,
    ...(output.trim().length === 0 ? {} : { output }),
  }
}

async function runInProcess(request: RunRequest): Promise<CheckResult> {
  const { check, scope } = request
  const started = performance.now()
  const found = await (check.builtin === undefined ? ruleSetOf(request) : builtinOf(request))
  const allowed = kept(found.findings, request)
  const suppressed = found.findings.length - allowed.length
  const outcome = { ...found, findings: allowed }
  const lines = [
    ...outcome.findings.map(describeFinding),
    ...outcome.broken.map(describeParseFailure),
  ]
  return {
    check: check.id,
    scope,
    status: 'ran',
    findings: outcome.findings.length + outcome.broken.length,
    pathsRead: outcome.read.length,
    durationMs: Math.round(performance.now() - started),
    ...(lines.length === 0 ? {} : { output: `${lines.join('\n')}\n` }),
    ...(suppressed === 0 ? {} : { suppressed }),
    perPath: countByPath(allowed),
  }
}

function countByPath(findings: readonly StructureFinding[]): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {}
  for (const finding of findings) counts[finding.path] = (counts[finding.path] ?? 0) + 1
  return counts
}

function countOf(resolved: ResolvedLimit | null): { count?: ResolvedCount } {
  if (resolved?.measure === undefined) return {}
  return { count: { measure: resolved.measure, limit: resolved.limit, setting: resolved.setting } }
}

function kept(findings: readonly StructureFinding[], request: RunRequest): readonly StructureFinding[] {
  const exceptions = request.exceptions ?? []
  if (exceptions.length === 0) return findings
  return findings.filter((finding) => exceptionFor(exceptions, targetOf(finding, request)) === undefined)
}

function targetOf(finding: StructureFinding, request: RunRequest): Suppressible {
  return {
    check: request.check.id,
    path: finding.path,
    rule: finding.rule,
    ...(finding.symbol === undefined ? {} : { symbol: finding.symbol }),
  }
}

async function ruleSetOf(request: RunRequest): Promise<StructureOutcome> {
  return await runStructure({
    root: request.root,
    paths: request.paths,
    rules: await readRules(request.ruleSet as string),
    ...countOf(limitFor(request.check, request.limits)),
  })
}

async function builtinOf(request: RunRequest): Promise<StructureOutcome> {
  const { check } = request
  const resolved = limitFor(check, request.limits)
  return await runBuiltin(check.builtin as string, {
    root: request.root,
    paths: request.paths,
    rule: check.id,
    limit: resolved?.limit ?? Number.POSITIVE_INFINITY,
    setting: resolved?.setting ?? '',
    entryPoints: request.entryPoints ?? [],
  })
}

function limitFor(check: Check, limits: ReadonlyMap<string, unknown> | undefined): ResolvedLimit | null {
  if (check.limit === undefined) return null
  const value = limits?.get(check.limit.setting)
  if (typeof value !== 'number') {
    throw new Error(
      `${check.id}: measures against \`${check.limit.setting}\`, which no selected preset defines.\n` +
        '  Declare it in the preset\'s [defaults], or take the [checks.limit] table out.',
    )
  }
  return {
    ...(check.limit.measure === undefined ? {} : { measure: check.limit.measure }),
    limit: value,
    setting: check.limit.setting,
  }
}

type ResolvedLimit = { measure?: ResolvedCount['measure']; limit: number; setting: string }

async function invokeCheck(request: RunRequest): Promise<readonly Answer[]> {
  const base = [...(request.check.command ?? []), ...request.configArgs]
  if (request.check.takes !== 'one-file') {
    const tail = request.check.takes === 'project' ? [] : request.paths
    return [await invoke({ command: [...base, ...tail], cwd: request.root })]
  }
  const answers: Answer[] = []
  for (const path of request.paths) {
    answers.push(await invoke({ command: [...base, path], cwd: request.root }))
  }
  return answers
}

function countFindings(check: Check, answers: readonly Answer[], output: string): number {
  if (check.failsOn === 'exit-code') {
    return answers.filter((answer) => answer.outcome !== 'ran' || answer.code !== 0).length
  }
  const pattern = check.countRegex
  if (pattern === undefined) return 0
  return [...output.matchAll(new RegExp(pattern, 'gu'))].length
}

function brokenBy(check: Check, output: string): string | null {
  for (const toolError of check.toolErrors) {
    if (new RegExp(toolError.regex, 'u').test(output)) return toolError.message
  }
  return null
}

function skipped(request: RunRequest, skip: Skip): CheckResult {
  return {
    check: request.check.id,
    scope: request.scope,
    status: 'skipped',
    findings: 0,
    pathsRead: request.paths.length,
    durationMs: 0,
    reason: skip.reason,
    platform: skip.platform,
  }
}

function textOf(answer: Answer): string {
  return answer.outcome === 'ran' ? `${answer.stdout}${answer.stderr}` : ''
}

export function failsTheGate(result: CheckResult): boolean {
  if (result.status === 'skipped') return result.platform !== true
  return result.findings > 0
}
