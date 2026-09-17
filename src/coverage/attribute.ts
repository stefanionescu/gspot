import { stdoutOf } from '@/run/invoke'
import type { PathAttributes } from 'types/coverage'
import { invoke } from '@/run/invoke'

const ASKED = ['linguist-generated', 'linguist-vendored', 'text', 'filter'] as const
const NONE: PathAttributes = { generated: false, vendored: false, notText: false, filter: null }

export async function readAttributes(
  root: string,
  paths: readonly string[],
): Promise<ReadonlyMap<string, PathAttributes>> {
  if (paths.length === 0) return new Map()
  const answer = await invoke({
    command: ['git', 'check-attr', '--stdin', '-z', ...ASKED],
    cwd: root,
    stdin: `${paths.join('\0')}\0`,
  })
  return readRecords(stdoutOf(answer, 'git check-attr'))
}

export function attributesOf(
  attributes: ReadonlyMap<string, PathAttributes>,
  path: string,
): PathAttributes {
  return attributes.get(path) ?? NONE
}

function readRecords(output: string): ReadonlyMap<string, PathAttributes> {
  const fields = output.split('\0')
  const attributes = new Map<string, PathAttributes>()
  for (let at = 0; at + 2 < fields.length; at += 3) {
    const path = fields[at]
    const name = fields[at + 1]
    const value = fields[at + 2]
    if (path === undefined || name === undefined || value === undefined) break
    attributes.set(path, apply(attributes.get(path) ?? NONE, name, value))
  }
  return attributes
}

function apply(current: PathAttributes, name: string, value: string): PathAttributes {
  switch (name) {
    case 'linguist-generated':
      return { ...current, generated: value === 'set' || value === 'true' }
    case 'linguist-vendored':
      return { ...current, vendored: value === 'set' || value === 'true' }
    case 'text':
      return { ...current, notText: value === 'unset' }
    case 'filter':
      return { ...current, filter: value === 'unspecified' ? null : value }
    default:
      return current
  }
}
