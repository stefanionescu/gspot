import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { decide, readIgnoreFile } from '@/coverage/gitignore'
import type { IgnoreVerdict, Listing } from 'types/coverage'
import type { IgnoreSource } from 'types/coverage'

export async function readIgnoreSources(
  root: string,
  tracked: readonly string[],
  names: readonly string[],
): Promise<readonly IgnoreSource[]> {
  const found = tracked.filter((path) => names.includes(path.slice(path.lastIndexOf('/') + 1)))
  const sources: IgnoreSource[] = []
  for (const path of found.sort(byDepth)) {
    const cut = path.lastIndexOf('/')
    const directory = cut === -1 ? '' : path.slice(0, cut)
    sources.push({ directory, patterns: readIgnoreFile(await readFile(join(root, path), 'utf8'), path) })
  }
  return sources
}

function byDepth(left: string, right: string): number {
  const depth = left.split('/').length - right.split('/').length
  return depth === 0 ? (left < right ? -1 : 1) : depth
}

export function replay(sources: readonly IgnoreSource[], path: string): IgnoreVerdict | null {
  const segments = path.split('/')
  for (let depth = 1; depth < segments.length; depth += 1) {
    const verdict = verdictFor(sources, segments.slice(0, depth).join('/'), true)
    if (verdict?.ignored === true) return verdict
  }
  return verdictFor(sources, path, false)
}

function verdictFor(
  sources: readonly IgnoreSource[],
  path: string,
  isDirectory: boolean,
): IgnoreVerdict | null {
  let verdict: IgnoreVerdict | null = null
  for (const source of sources) {
    const within = relativeTo(source.directory, path)
    if (within === null) continue
    const decided = decide(source.patterns, within, isDirectory)
    if (decided !== null) verdict = { ...decided, at: path }
  }
  return verdict
}

function relativeTo(directory: string, path: string): string | null {
  if (directory === '') return path
  if (!path.startsWith(`${directory}/`)) return null
  return path.slice(directory.length + 1)
}

export function replayListing(
  sources: readonly IgnoreSource[],
  candidates: readonly string[],
): Listing {
  const paths = new Set<string>()
  const ignored: string[] = []
  for (const candidate of candidates) {
    if (replay(sources, candidate)?.ignored === true) ignored.push(candidate)
    else paths.add(candidate)
  }
  return { via: 'ignore-replay', paths, untracked: [], ignored }
}

export function explainIgnored(verdict: IgnoreVerdict): string {
  const { source, line, text } = verdict.pattern
  return `ignored by ${source}:${line}  pattern ${text}`
}
