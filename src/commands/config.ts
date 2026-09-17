import { slotsOf } from '@/settings/merge'
import type { ConfigOptions, Lines } from 'types/commands'
import { repositoryRoot } from '@/coverage/tracked'
import type { Policy } from 'types/settings'
import { readPolicy } from '@/settings/policy'

export async function runConfig(options: ConfigOptions): Promise<Lines> {
  const policy = await readPolicy(await repositoryRoot(options.cwd), options.presetsRoot)
  return options.tool === undefined ? everySetting(policy) : oneTool(policy, options.tool)
}

function everySetting(policy: Policy): Lines {
  const slots = slotsOf(policy.presets)
  const lines: string[] = []
  for (const [name, slot] of [...slots].sort()) {
    const resolved = policy.merged.settings.get(name)
    const value = resolved === undefined ? '(unset)' : JSON.stringify(resolved.value)
    lines.push(`${name.padEnd(36)} ${slot.ops.join(',').padEnd(16)} ${value}`)
    for (const source of resolved?.sources ?? []) lines.push(`${' '.repeat(38)}from ${source}`)
  }
  if (lines.length === 0) lines.push('the current selection exposes no settings.')
  return { lines, code: 0 }
}

function oneTool(policy: Policy, tool: string): Lines {
  const lines: string[] = []
  for (const preset of policy.presets) {
    for (const artifact of preset.configs) {
      if (!artifact.target.includes(tool)) continue
      lines.push(`${artifact.target}`)
      lines.push(`  rendered by ${preset.id} from ${artifact.template}`)
      lines.push(`  read by     ${artifact.readers.join(', ')}`)
    }
  }
  if (lines.length === 0) {
    return { lines: [`no selected preset renders a configuration for \`${tool}\`.`], code: 1 }
  }
  return { lines, code: 0 }
}
