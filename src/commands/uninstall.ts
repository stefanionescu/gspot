import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { removeBlock } from '@/configuration/marked'
import { repositoryRoot } from '@/coverage/tracked'
import { uninstallHooks } from '@/runner/hooks'
import type { Lines } from 'types/commands'
import { MANAGED_FILES } from '@config/paths'

export async function runUninstall(options: { readonly cwd: string }): Promise<Lines> {
  const root = await repositoryRoot(options.cwd)
  const lines: string[] = []

  await uninstallHooks(root)
  lines.push('removed      .gspot/hooks/ and the core.hooksPath setting')

  await rm(join(root, '.gspot'), { recursive: true, force: true })
  lines.push('removed      .gspot/ including the tool cache')

  for (const path of MANAGED_FILES) {
    await removeBlock(root, path)
    lines.push(`changed      ${path} (the managed block only)`)
  }

  lines.push('kept         gspot.toml, which is yours')
  lines.push('kept         your rule layer, which gspot never wrote')
  lines.push('')
  lines.push('gspot restores nothing. Git holds the state before init.')
  return { lines, code: 0 }
}
