import type { HooksOptions, Lines } from 'types/commands'
import { repositoryRoot } from '@/coverage/tracked'
import { installHooks, uninstallHooks } from '@/runner/hooks'

export async function runHooks(options: HooksOptions): Promise<Lines> {
  const root = await repositoryRoot(options.cwd)
  if (options.action === 'uninstall') {
    const removed = await uninstallHooks(root)
    return { lines: [`removed      ${removed.join(', ') || 'nothing'}`], code: 0 }
  }
  const outcome = await installHooks(root)
  const lines = [`installed    ${outcome.written.join(', ') || 'nothing'}`]
  for (const refused of outcome.refused) {
    lines.push(`kept         ${refused} was not written by gspot, so it is left alone`)
  }
  return { lines, code: outcome.refused.length === 0 ? 0 : 1 }
}
