import { filenameOf } from '@/detect/extension'
import { PREFIX_PARTS, SOURCE_SEPARATORS } from '@config/structure'
import type { StructureFinding } from 'types/structure'

export function singleFileFolders(paths: readonly string[], rule: string): readonly StructureFinding[] {
  const byDirectory = group(paths)
  const parents = new Set([...byDirectory.keys()].map(parentOf).filter((name) => name !== null))
  return [...byDirectory]

    .filter(([directory, files]) => directory !== '' && files.length === 1 && !parents.has(directory))
    .map(([directory, files]) => ({
      rule,
      path: files[0] as string,
      at: { line: 1, column: 1 },
      message: `\`${directory || '.'}\` holds one file and nothing else.`,
      text: 'move the file up, or put the things that belong with it beside it',
    }))
}

export function prefixCollisions(
  paths: readonly string[],
  rule: string,
  threshold: number,
): readonly StructureFinding[] {
  const findings: StructureFinding[] = []
  for (const [directory, files] of group(paths)) {
    for (const [prefix, sharing] of byPrefix(files)) {
      if (sharing.length < threshold) continue
      findings.push({
        rule,
        path: sharing[0] as string,
        at: { line: 1, column: 1 },
        message: `${sharing.length} files in \`${directory || '.'}\` share the prefix \`${prefix}\`.`,
        text: sharing.map(filenameOf).join(', '),
      })
    }
  }
  return findings
}

function group(paths: readonly string[]): ReadonlyMap<string, string[]> {
  const byDirectory = new Map<string, string[]>()
  for (const path of paths) {
    const directory = path.slice(0, Math.max(0, path.lastIndexOf('/')))
    byDirectory.set(directory, [...(byDirectory.get(directory) ?? []), path])
  }
  return byDirectory
}

function parentOf(directory: string): string | null {
  const at = directory.lastIndexOf('/')
  return directory === '' ? null : directory.slice(0, Math.max(0, at))
}

function byPrefix(files: readonly string[]): ReadonlyMap<string, string[]> {
  const byPrefix = new Map<string, string[]>()
  for (const file of files) {
    const parts = filenameOf(file).split(SOURCE_SEPARATORS).filter((part) => part.length > 0)
    if (parts.length <= PREFIX_PARTS) continue
    const prefix = parts.slice(0, PREFIX_PARTS).join('-')
    byPrefix.set(prefix, [...(byPrefix.get(prefix) ?? []), file])
  }
  return byPrefix
}

