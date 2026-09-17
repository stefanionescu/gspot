import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { HOOK_MARKER, HOOK_NAMES } from '@config/hooks'
import { HOOKS_DIRECTORY } from '@config/paths'
import type { HookName } from 'types/runner'
import type { HookOutcome } from 'types/runner'
import { invoke } from '@/run/invoke'

function bodyOf(hook: HookName): string {
  return `#!/usr/bin/env bash\n${HOOK_MARKER}\nexec gspot check --stage ${hook}\n`
}

export async function installHooks(root: string): Promise<HookOutcome> {
  const directory = join(root, HOOKS_DIRECTORY)
  await mkdir(directory, { recursive: true })
  const written: string[] = []
  const refused: string[] = []

  for (const hook of HOOK_NAMES) {
    const target = join(directory, hook)
    if (await someoneElseWrote(target)) {
      refused.push(hook)
      continue
    }
    await writeFile(target, bodyOf(hook), 'utf8')
    await chmod(target, 0o755)
    written.push(hook)
  }
  await setHooksPath(root, HOOKS_DIRECTORY)
  return { written, refused }
}

export async function uninstallHooks(root: string): Promise<readonly string[]> {
  const removed: string[] = []
  for (const hook of HOOK_NAMES) {
    const target = join(root, HOOKS_DIRECTORY, hook)
    if (await someoneElseWrote(target)) continue
    await rm(target, { force: true })
    removed.push(hook)
  }
  await invoke({ command: ['git', 'config', '--unset', 'core.hooksPath'], cwd: root })
  return removed
}

async function someoneElseWrote(target: string): Promise<boolean> {
  try {
    return !(await readFile(target, 'utf8')).includes(HOOK_MARKER)
  } catch {
    return false
  }
}

async function setHooksPath(root: string, path: string): Promise<void> {
  const answer = await invoke({ command: ['git', 'config', 'core.hooksPath', path], cwd: root })
  if (answer.outcome === 'ran' && answer.code === 0) return
  throw new Error(`git refused core.hooksPath at ${path}. Set it by hand, or run without hooks.`)
}

export async function hooksPath(root: string): Promise<string | null> {
  const answer = await invoke({ command: ['git', 'config', '--get', 'core.hooksPath'], cwd: root })
  if (answer.outcome !== 'ran' || answer.code !== 0) return null
  const value = answer.stdout.trim()
  return value.length === 0 ? null : value
}
