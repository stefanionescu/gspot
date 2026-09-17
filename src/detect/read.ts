import { readFile } from 'node:fs/promises'

export async function readOrNull(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8')
  } catch {
    return null
  }
}

export async function readOrEmpty(path: string): Promise<string> {
  return (await readOrNull(path)) ?? ''
}
