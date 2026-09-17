import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { Files } from '@config/tests/repositories'
import { invoke, stdoutOf } from '@/run/invoke'

export const PRESETS = join(import.meta.dirname, '..', '..', 'presets')

const SETUP: readonly (readonly string[])[] = [
  ['init', '-q', '--initial-branch=main'],
  ['config', 'user.email', 'test@example.invalid'],
  ['config', 'user.name', 'Test'],
  ['config', 'core.ignorecase', 'false'],
]

async function git(root: string, ...args: string[]): Promise<void> {
  stdoutOf(await invoke({ command: ['git', ...args], cwd: root }), `git ${args[0]}`)
}

export async function plantUncommitted(name: string, files: Files): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), `gspot-${name}-`))
  for (const args of SETUP) await git(root, ...args)
  await write(root, files)
  return root
}

export async function plant(name: string, files: Files): Promise<string> {
  const root = await plantUncommitted(name, files)
  await commitEverything(root)
  return root
}

export async function write(root: string, files: Files): Promise<void> {
  for (const [path, contents] of Object.entries(files)) {
    const target = join(root, path)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, contents, 'utf8')
  }
}

export async function commitEverything(root: string, message = 'first'): Promise<void> {
  await git(root, 'add', '-A')
  await git(root, 'commit', '-q', '-m', message)
}

export async function removeRepository(root: string): Promise<void> {
  await rm(root, { recursive: true, force: true })
}

export async function statusOf(root: string): Promise<string> {
  return stdoutOf(
    await invoke({ command: ['git', 'status', '--porcelain', '--untracked-files=all'], cwd: root }),
    'git status',
  )
}

export async function configOf(root: string, key: string): Promise<string> {
  return stdoutOf(await invoke({ command: ['git', 'config', '--get', key], cwd: root }), 'git config')
    .trim()
}
