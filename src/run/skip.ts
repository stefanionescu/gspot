import { platform } from 'node:os'
import { DAEMON_PROBE_TIMEOUT_MILLISECONDS } from '@config/limits'

import { SKIP_PREDICATES } from 'types/manifest'
import type { Skip } from 'types/run'
import { invoke } from '@/run/invoke'

export async function skipReasonFor(predicate: string | undefined, cwd: string): Promise<Skip | null> {
  switch (predicate) {
    case undefined:
      return null
    case 'linux-only':
      return platform() === 'linux' ? null : { reason: 'linux only', platform: true }
    case 'macos-only':
      return platform() === 'darwin' ? null : { reason: 'macOS only', platform: true }
    case 'docker-daemon':
      return await dockerRunning(cwd)
    default:
      throw new Error(
        `\`${predicate}\` is not a skip predicate. It is one of: ${SKIP_PREDICATES.join(', ')}.`,
      )
  }
}

async function dockerRunning(cwd: string): Promise<Skip | null> {
  const answer = await invoke({ command: ['docker', 'info'], cwd, timeoutMs: DAEMON_PROBE_TIMEOUT_MILLISECONDS })
  const up = answer.outcome === 'ran' && answer.code === 0
  return up ? null : { reason: 'docker daemon unavailable', platform: false }
}
