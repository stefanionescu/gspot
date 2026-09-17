import { pathsByCheck } from '@/coverage/measure'

import { buildGraph } from '@/run/graph'

import { FIX_STAGES, type Check, type FixStage } from 'types/manifest'

import type { Policy } from 'types/settings'
import type { FixOptions, FixOutcome } from 'types/commands'
import { runChecks } from '@/commands/check'

import { measure } from '@/coverage/measure'
import { repositoryRoot } from '@/coverage/tracked'
import { invoke } from '@/run/invoke'
import { readPolicy, sweepOf } from '@/settings/policy'

export async function runFix(options: FixOptions): Promise<FixOutcome> {
  const root = await repositoryRoot(options.cwd)
  const policy = await readPolicy(root, options.presetsRoot)
  const measurement = await measure(sweepOf(policy))
  const claimed = pathsByCheck(measurement)
  const fixers = fixersIn(policy, options.only)

  const lines: string[] = []
  for (const stage of FIX_STAGES) {
    for (const check of fixers.filter((candidate) => stageOf(candidate) === stage)) {
      lines.push(...(await applyFix(root, check, claimed.get(check.id) ?? [])))
    }
  }

  const after = await runChecks({ ...options, cwd: root, skip: [], unchecked: false })
  lines.push('', ...after.lines)
  return { lines, results: after.results, code: after.code }
}

function fixersIn(policy: Policy, only: string | undefined): readonly Check[] {
  return buildGraph(policy.scopes, null)
    .flatMap((node) => node.checks)
    .filter((check) => check.fix !== undefined && (only === undefined || check.id === only))
    .filter(firstTimeSeen())
}

function firstTimeSeen(): (check: Check) => boolean {
  const seen = new Set<string>()
  return (check) => {
    if (seen.has(check.id)) return false
    seen.add(check.id)
    return true
  }
}

function stageOf(check: Check): FixStage {
  if (check.fixStage !== undefined) return check.fixStage
  return check.inspects.includes('format') ? 'format' : 'codemod'
}

async function applyFix(
  root: string,
  check: Check,
  paths: readonly string[],
): Promise<readonly string[]> {
  const fix = check.fix
  if (fix === undefined || paths.length === 0) return []
  const answer = await invoke({ command: [...fix, ...paths], cwd: root })
  if (answer.outcome !== 'ran') {
    return [`fix          ${check.id.padEnd(20)} did not run: ${answer.outcome}`]
  }
  return [`fix          ${check.id.padEnd(20)} ${paths.length} file(s)`]
}
