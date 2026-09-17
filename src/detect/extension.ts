import type { TrackedPath } from 'types/coverage'

export function extensionOf(path: string): string {
  const name = path.slice(path.lastIndexOf('/') + 1)
  const dot = name.lastIndexOf('.')

  return dot <= 0 ? '' : name.slice(dot).toLowerCase()
}

export function filenameOf(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

export function extensionCounts(paths: readonly TrackedPath[]): ReadonlyMap<string, number> {
  const counts = new Map<string, number>()
  for (const entry of paths) {
    const extension = extensionOf(entry.path)
    counts.set(extension, (counts.get(extension) ?? 0) + 1)
  }
  return new Map([...counts].sort((left, right) => right[1] - left[1]))
}
