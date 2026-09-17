import { open } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { SHEBANG_READ_BYTES } from '@config/limits'

export async function interpreterIn(root: string, path: string): Promise<string | null> {
  const line = await firstLine(join(root, path))
  return line === null ? null : interpreterOf(line)
}

export function interpreterOf(line: string): string | null {
  if (!line.startsWith('#!')) return null
  const words = line.slice(2).trim().split(/\s+/u).filter((word) => word.length > 0)
  const program = words[0]
  if (program === undefined) return null
  if (basename(program) !== 'env') return basename(program)

  const named = words.slice(1).find((word) => !word.startsWith('-'))
  return named === undefined ? null : basename(named)
}

async function firstLine(absolute: string): Promise<string | null> {
  let handle
  try {
    handle = await open(absolute, 'r')
  } catch {
    return null
  }
  try {
    const buffer = Buffer.alloc(SHEBANG_READ_BYTES)
    const { bytesRead } = await handle.read(buffer, 0, SHEBANG_READ_BYTES, 0)
    const head = buffer.subarray(0, bytesRead)
    if (head.includes(0)) return null
    const end = head.indexOf(0x0a)
    return head.subarray(0, end === -1 ? bytesRead : end).toString('utf8')
  } finally {
    await handle.close()
  }
}
