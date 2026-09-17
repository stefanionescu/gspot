import { Command } from 'commander'
import type { Inspection, Stage } from 'types/manifest'
import { readInitFlags, type CheckFlagInput, type InitFlagInput } from '@/commands/flags'

import { completionFor } from '@/commands/completion'

import { SHELLS } from 'types/commands'
import type { Shell } from 'types/commands'
import type { Surroundings } from 'types/commands'

import { runChecks } from '@/commands/check'
import { runConfig } from '@/commands/config'
import { runCoverage } from '@/commands/coverage'
import { runDoctor } from '@/commands/doctor'
import { runExplain } from '@/commands/explain'
import { runFix } from '@/commands/fix'
import { runGenerate } from '@/commands/generate'
import { runHooks } from '@/commands/hooks'
import { runInit } from '@/commands/init'
import { runInstall } from '@/commands/install'
import { runReport } from '@/commands/report'
import { runUninstall } from '@/commands/uninstall'
import { runUpgrade } from '@/commands/upgrade'
import { optional } from '@/settings/optional'

export function buildProgram(at: Surroundings): { readonly program: Command; readonly code: () => 0 | 1 | 2 } {
  let code: 0 | 1 | 2 = 0
  const say = (lines: readonly string[]): void => {
    for (const line of lines) at.write(line)
  }

  const program = new Command('gspot')
    .description('A linter that proves its own coverage, and a repository of agent rule files.')
    .version(at.version)
    .exitOverride()

    .configureOutput({ writeErr: () => {} })

  program
    .command('init')
    .description('Read the repository, propose a policy, and write it once you say yes')
    .option('--yes', 'take every proposal', false)
    .option('--presets <ids...>', 'the preset selection')
    .option('--runner <name>', 'mise | bun | npm')
    .option('--hooks <answer>', 'yes | no')
    .option('--ci <provider>', 'none | github | gitlab | buildkite')
    .option('--rules <answer>', 'yes | no')
    .action(async (flags: InitFlagInput) => {
      const outcome = await runInit({
        cwd: at.cwd,
        presetsRoot: at.presetsRoot,
        version: at.version,
        yes: flags.yes ?? false,
        flags: readInitFlags(flags),
        interactive: at.interactive,
      })
      say(outcome.lines)
      code = outcome.code
    })

  program
    .command('generate')
    .description('Re-render every generated file from gspot.toml')
    .option('--check', 'compare rather than write, and fail on a difference', false)
    .action(async (flags: { check: boolean }) => {
      const outcome = await runGenerate({ ...at, check: flags.check })
      say(outcome.lines)
      code = outcome.code
    })

  program
    .command('check')
    .description('Run the gate')
    .argument('[id]', 'one check, by id')
    .option('--stage <name>', 'what the hook of that name runs')
    .option('--scope <name>', 'one scope of a monorepo')
    .option('--inspects <name>', 'every check that looks for one thing')
    .option('--since <ref>', 'only over files changed since a ref')
    .option('--skip <id...>', 'skip one check for this run', [])
    .option('--unchecked', 'print only the files nothing reads', false)
    .action(async (id: string | undefined, flags: CheckFlagInput) => {
      const outcome = await runChecks({
        ...at,
        ...optional('only', id),
        ...optional('stage', flags.stage as Stage | undefined),
        ...optional('scope', flags.scope),
        ...optional('inspects', flags.inspects as Inspection | undefined),
        ...optional('since', flags.since),
        skip: flags.skip ?? [],
        unchecked: flags.unchecked ?? false,
      })
      say(outcome.lines)
      code = outcome.code
    })

  program
    .command('coverage')
    .description('Ask every check which files it reads, and write the path table')
    .option('--diff', 'fail on any regression against the tracked table', false)
    .action(async (flags: { diff: boolean }) => {
      const outcome = await runCoverage({ ...at, diff: flags.diff })
      say(outcome.lines)
      code = outcome.code
    })

  program
    .command('fix')
    .description('Every fixer in a fixed order, then the checks again to prove they converged')
    .argument('[id]', 'one check, by id')
    .action(async (id: string | undefined) => {
      const outcome = await runFix({ ...at, ...optional('only', id) })
      say(outcome.lines)
      code = outcome.code
    })

  program
    .command('report')
    .description('The last run')
    .option('--failed', 'only the failures, each with the command that reproduces it', false)
    .option('--sarif', 'the SARIF document', false)
    .option('--json', 'the run report as JSON', false)
    .action(async (flags: { failed: boolean; sarif: boolean; json: boolean }) => {
      const outcome = await runReport({ cwd: at.cwd, ...flags })
      say(outcome.lines)
      code = outcome.code
    })

  program
    .command('config')
    .description('Every value resolved from gspot.toml, with its source')
    .argument('[tool]', 'one tool')
    .action(async (tool: string | undefined) => {
      const outcome = await runConfig({ ...at, ...optional('tool', tool) })
      say(outcome.lines)
      code = outcome.code
    })

  program
    .command('explain')
    .description('What a rule checks, and which preset turns it on')
    .argument('<rule>')
    .action(async (rule: string) => {
      const outcome = await runExplain({ ...at, rule })
      say(outcome.lines)
      code = outcome.code
    })

  program
    .command('doctor')
    .description('What is missing, what it blocks, and what coverage it costs')
    .action(async () => {
      const outcome = await runDoctor(at)
      say(outcome.lines)
      code = outcome.code
    })

  program
    .command('install')
    .description('Download every tool the lock names, and verify every checksum')
    .action(async () => {
      const outcome = await runInstall(at)
      say(outcome.lines)
      code = outcome.code
    })

  program
    .command('uninstall')
    .description('Remove what init wrote and install downloaded')
    .action(async () => {
      const outcome = await runUninstall({ cwd: at.cwd })
      say(outcome.lines)
      code = outcome.code
    })

  program
    .command('upgrade')
    .description('What a newer version changes, and whether it costs coverage')
    .option('--check', 'report without writing', false)
    .option('--to <version>', 'an exact version, downward included')
    .option('--against <path>', 'a preset tree to compare against')
    .action(async (flags: { check: boolean; to?: string; against?: string }) => {
      const outcome = await runUpgrade({
        ...at,
        check: flags.check,
        ...optional('to', flags.to),
        ...optional('against', flags.against),
      })
      say(outcome.lines)
      code = outcome.code
    })

  program
    .command('hooks')
    .description('Write the git hooks, or take them away')
    .argument('<action>', 'install | uninstall')
    .action(async (action: string) => {
      if (action !== 'install' && action !== 'uninstall') {
        say([`hooks takes install or uninstall, and it was given "${action}".`])
        code = 2
        return
      }
      const outcome = await runHooks({ cwd: at.cwd, action })
      say(outcome.lines)
      code = outcome.code
    })

  program
    .command('completion')
    .description('The completion script for one shell')
    .argument('<shell>', SHELLS.join(' | '))
    .action((shell: string) => {
      if (!(SHELLS as readonly string[]).includes(shell)) {
        say([`completion takes ${SHELLS.join(', ')}, and it was given "${shell}".`])
        code = 2
        return
      }
      say(completionFor(shell as Shell).split('\n'))
    })

  return { program, code: () => code }
}
