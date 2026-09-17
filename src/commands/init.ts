import { rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describePlan, planFrom, proposeAnswers } from '@/settings/proposal'
import { describeReading } from '@/settings/reading'

import type { Answers, Plan, Reading } from 'types/detect'
import { CI_PROVIDERS, RUNNERS } from 'types/settings'
import { AGENT_INDEX_BLOCK, GITIGNORE_BLOCK } from '@config/blocks'
import type { InitFlags, InitOptions, InitOutcome } from 'types/commands'
import { runGenerate } from '@/commands/generate'
import { writeBlock } from '@/configuration/marked'
import { repositoryRoot } from '@/coverage/tracked'

import { installHooks } from '@/runner/hooks'
import { readRepository } from '@/settings/reading'
import { readPresets } from '@/settings/selection'

export async function runInit(options: InitOptions): Promise<InitOutcome> {
  const root = await repositoryRoot(options.cwd)
  const refusal = await refuseExisting(root)
  if (refusal !== null) return { lines: [refusal], plan: null, code: 2 }

  const available = await readPresets(options.presetsRoot)
  const reading = await readRepository(root, available)
  const lines = [...describeReading(reading), '']

  const answers = answersFor(reading, options)
  if (typeof answers === 'string') return { lines: [...lines, answers], plan: null, code: 2 }

  const plan = planFrom(reading, answers)
  lines.push(...describePlan(plan))

  const accepted = options.confirm === undefined ? true : await options.confirm(plan)
  if (!accepted) {
    lines.push('nothing written. The repository is untouched.')
    return { lines, plan, code: 0 }
  }
  lines.push(...(await apply(root, reading, answers, plan, options)))
  return { lines, plan, code: 0 }
}

async function refuseExisting(root: string): Promise<string | null> {
  const file = Bun.file(join(root, 'gspot.toml'))
  if (!(await file.exists())) return null
  return (
    'gspot.toml already exists, and init writes it once.\n' +
    '  To see what this repository has gained since, run `gspot doctor`.\n' +
    '  To change the policy, edit gspot.toml and run `gspot generate`.'
  )
}

function answersFor(reading: Reading, options: InitOptions): Answers | string {
  const proposed = proposeAnswers(reading)
  const { flags, yes } = options
  const unanswered = missing(flags, yes, options.interactive)
  if (unanswered !== null) return unanswered

  return {
    runner: flags.runner ?? proposed.runner,
    presets: flags.presets ?? proposed.presets,
    scopes: proposed.scopes,
    ownedTools: proposed.ownedTools,
    declarations: proposed.declarations,
    hooks: flags.hooks ?? proposed.hooks,
    ci: flags.ci ?? proposed.ci,
    rules: flags.rules ?? proposed.rules,
  }
}

function missing(flags: InitFlags, yes: boolean, interactive: boolean): string | null {
  if (yes || interactive) return null
  const wanted: readonly [keyof InitFlags, string][] = [
    ['presets', '--presets <ids>'],
    ['runner', `--runner ${RUNNERS.join('|')}`],
    ['hooks', '--hooks yes|no'],
    ['ci', `--ci ${CI_PROVIDERS.join('|')}`],
    ['rules', '--rules yes|no'],
  ]
  const absent = wanted.filter(([key]) => flags[key] === undefined)
  if (absent.length === 0) return null
  return (
    'there is no terminal here, and these questions have no answer:\n' +
    absent.map(([, flag]) => `  ${flag}`).join('\n') +
    '\n  Pass the flags, or pass --yes to take every proposal.'
  )
}

async function apply(
  root: string,
  reading: Reading,
  answers: Answers,
  plan: Plan,
  options: InitOptions,
): Promise<readonly string[]> {
  const lines: string[] = []
  await writeFile(join(root, 'gspot.toml'), plan.settings, 'utf8')
  lines.push('wrote        gspot.toml')

  for (const entry of plan.deletes) {
    await rm(join(root, entry.path), { recursive: true, force: true })
    lines.push(`deleted      ${entry.path}`)
  }

  await writeBlock(root, '.gitignore', GITIGNORE_BLOCK)
  lines.push('changed      .gitignore')
  for (const path of reading.agentRules) {
    await writeBlock(root, path, AGENT_INDEX_BLOCK)
    lines.push(`changed      ${path}`)
  }

  const generated = await runGenerate({
    cwd: root,
    presetsRoot: options.presetsRoot,
    version: options.version,
    check: false,
  })
  lines.push(...generated.lines)

  if (answers.hooks) {
    const hooks = await installHooks(root)
    lines.push(`hooks        ${hooks.written.join(', ')}`)
    for (const refused of hooks.refused) {
      lines.push(`kept         ${refused} was not written by gspot, so it is left alone`)
    }
  }
  return lines
}
