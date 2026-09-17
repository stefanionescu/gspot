import { toolsOf } from '@/toolchain/presence'
import type { Lock } from 'types/toolchain'
import type { InstallOptions, Lines } from 'types/commands'
import { repositoryRoot } from '@/coverage/tracked'

import { installHooks } from '@/runner/hooks'
import type { Policy } from 'types/settings'
import { readPolicy } from '@/settings/policy'
import { install } from '@/toolchain/install'
import { hostKey, readLock, writeLock } from '@/toolchain/lock'

export async function runInstall(options: InstallOptions): Promise<Lines> {
  const root = await repositoryRoot(options.cwd)
  const policy = await readPolicy(root, options.presetsRoot)
  const lock = (await readLock(root)) ?? seedLock(policy)

  const outcome = await install(root, lock)
  const lines = [
    ...outcome.installed.map((tool) => `installed    ${tool}`),
    ...outcome.verified.map((tool) => `verified     ${tool}`),
    ...outcome.skipped.map((entry) => `skipped      ${entry.tool.padEnd(20)} ${entry.why}`),
    ...outcome.failures.map((entry) => `failed       ${entry.tool.padEnd(20)} ${entry.why}`),
  ]
  if (outcome.recorded.length > 0) {
    await writeLock(root, lock)
    lines.push(`recorded     ${outcome.recorded.join(', ')} in .gspot/tools.lock`)
  }
  if (policy.settings.gate.hooks) {
    const hooks = await installHooks(root)
    lines.push(`hooks        ${hooks.written.join(', ') || 'nothing'}`)
  }
  return { lines, code: outcome.failures.length === 0 ? 0 : 1 }
}

function seedLock(policy: Policy): Lock {
  const tools = new Map(
    [...toolsOf(policy.presets).values()].map((tool) => [
      tool.id,
      {
        id: tool.id,
        version: tool.version,
        provider: tool.provider,
        ...(tool.package === undefined ? {} : { package: tool.package }),
        assets:
          tool.url === undefined
            ? new Map()
            : new Map([[hostKey(), { url: tool.url, sha256: '' }]]),
      },
    ]),
  )
  return { version: 1, tools }
}
