import { slotsOf } from '@/settings/merge'
import type { ExplainOptions, Lines } from 'types/commands'
import { repositoryRoot } from '@/coverage/tracked'
import type { Policy } from 'types/settings'
import type { Check } from 'types/manifest'
import { readPolicy } from '@/settings/policy'

export async function runExplain(options: ExplainOptions): Promise<Lines> {
  const policy = await readPolicy(await repositoryRoot(options.cwd), options.presetsRoot)

  for (const preset of policy.presets) {
    const check = preset.checks.find((candidate) => candidate.id === options.rule)
    if (check === undefined) continue
    return { lines: describe(check, preset.id, [...slotsOf(policy.presets).keys()]), code: 0 }
  }
  return { lines: [notFound(options.rule, policy)], code: 1 }
}

function describe(check: Check, preset: string, settings: readonly string[]): readonly string[] {
  const head = check.id.split('/')[0] ?? ''
  return [
    `${check.id}`,
    `  looks for   ${check.inspects.join(', ')}`,
    `  turned on by ${preset}`,
    `  runs at     ${check.stage}${check.requires.length === 0 ? '' : `, needs ${check.requires.join(', ')}`}`,
    `  runs        ${runsAs(check)}`,
    `  fails on    ${check.failsOn}`,
    `  file listing ${check.fileList.via}`,
    `  settings    ${settings.filter((name) => name.startsWith(head)).join(', ') || 'none'}`,
    `  turn it off  [[exception]] with check = "${check.id}" and a reason, in gspot.toml`,
  ]
}

function runsAs(check: Check): string {
  if (check.rules !== undefined) return `gspot, over the rules in ${check.rules}`
  return (check.command ?? []).join(' ')
}

function notFound(rule: string, policy: Policy): string {
  const near = policy.presets
    .flatMap((preset) => preset.checks.map((check) => check.id))
    .filter((id) => id.startsWith(rule.split('/')[0] ?? ''))
  return (
    `\`${rule}\` is not a check the current selection carries.` +
    (near.length === 0 ? '' : `\n  Checks in that family: ${near.join(', ')}`)
  )
}
