import { readlink } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { stdoutOf } from '@/run/invoke'
import type { TrackedFiles, TrackedLink, TrackedPath } from 'types/coverage'
import { invoke } from '@/run/invoke'

const GIT_MODE = { regular: '100644', executable: '100755', symlink: '120000', submodule: '160000' }

export async function repositoryRoot(cwd: string): Promise<string> {
  const answer = await invoke({ command: ['git', 'rev-parse', '--show-toplevel'], cwd })
  if (answer.outcome !== 'ran' || answer.code !== 0) {
    throw new Error(
      `${cwd} is not inside a git repository.\n` +
        '  gspot reads the tracked file list from git and keeps no second ignore syntax of its own.\n' +
        '  Run `git init` first, or run gspot inside the repository you mean.',
    )
  }
  return answer.stdout.trim()
}

export async function trackedFiles(root: string): Promise<TrackedFiles> {
  const listing = stdoutOf(
    await invoke({ command: ['git', 'ls-files', '--stage', '-z'], cwd: root }),
    'git ls-files',
  )
  const paths: TrackedPath[] = []
  const submodules: string[] = []
  const linkPaths: string[] = []

  for (const entry of listing.split('\0')) {
    const record = readEntry(entry)
    if (record === null) continue
    if (record.mode === GIT_MODE.submodule) {
      submodules.push(record.path)
      continue
    }
    paths.push({ path: record.path, gitMode: gitModeOf(record.mode) })
    if (record.mode === GIT_MODE.symlink) linkPaths.push(record.path)
  }

  paths.sort((left, right) => (left.path < right.path ? -1 : 1))
  submodules.sort()
  return { root, paths, links: await readLinks(root, linkPaths), submodules }
}

type Entry = { readonly mode: string; readonly path: string }

function readEntry(entry: string): Entry | null {
  const tab = entry.indexOf('\t')
  if (tab === -1) return null
  const mode = entry.slice(0, entry.indexOf(' '))
  const path = entry.slice(tab + 1)
  if (mode.length === 0 || path.length === 0) return null
  return { mode, path }
}

function gitModeOf(mode: string): TrackedPath['gitMode'] {
  if (mode === GIT_MODE.symlink) return 'symlink'
  if (mode === GIT_MODE.executable) return 'executable'
  return 'file'
}

async function readLinks(root: string, paths: readonly string[]): Promise<TrackedLink[]> {
  const links: TrackedLink[] = []
  for (const path of paths) {
    const target = await readTarget(root, path)
    links.push({ path, target, inside: insideRoot(root, path, target) })
  }
  return links
}

async function readTarget(root: string, path: string): Promise<string> {
  try {
    return await readlink(join(root, path))
  } catch {
    const answer = await invoke({ command: ['git', 'show', `:${path}`], cwd: root })
    return answer.outcome === 'ran' && answer.code === 0 ? answer.stdout.trim() : ''
  }
}

function insideRoot(root: string, path: string, target: string): string | null {
  if (target.length === 0) return null
  const from = join(root, path, '..')
  const absolute = isAbsolute(target) ? target : resolve(from, target)
  const within = relative(root, absolute)
  return within.startsWith('..') || isAbsolute(within) ? null : within
}
