import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BLOCK_CLOSE, BLOCK_OPEN } from '@config/blocks'
import { readOrEmpty } from '@/detect/read'

type Comment = { readonly open: string; readonly close: string }

function commentFor(path: string): Comment {
  const markdown = path.endsWith('.md') || path.endsWith('.mdx')
  return markdown
    ? { open: `<!-- ${BLOCK_OPEN} -->`, close: `<!-- ${BLOCK_CLOSE} -->` }
    : { open: `# ${BLOCK_OPEN}`, close: `# ${BLOCK_CLOSE}` }
}

export function withBlock(contents: string, path: string, body: string): string {
  const { open, close } = commentFor(path)
  const block = `${open}\n${body.trimEnd()}\n${close}\n`
  const from = contents.indexOf(open)
  const to = contents.indexOf(close)

  if (from === -1 || to === -1 || to < from) {
    const separator = contents.length === 0 || contents.endsWith('\n') ? '' : '\n'
    const gap = contents.trimEnd().length === 0 ? '' : '\n'
    return `${contents}${separator}${gap}${block}`
  }
  return `${contents.slice(0, from)}${block}${contents.slice(to + close.length + 1)}`
}

export function withoutBlock(contents: string, path: string): string {
  const { open, close } = commentFor(path)
  const from = contents.indexOf(open)
  const to = contents.indexOf(close)
  if (from === -1 || to === -1 || to < from) return contents
  return `${contents.slice(0, from).trimEnd()}\n${contents.slice(to + close.length + 1).trimStart()}`
}

export async function writeBlock(root: string, path: string, body: string): Promise<void> {
  const target = join(root, path)
  await writeFile(target, withBlock(await readOrEmpty(target), path, body), 'utf8')
}

export async function removeBlock(root: string, path: string): Promise<void> {
  const target = join(root, path)
  const contents = await readOrEmpty(target)
  if (contents.length === 0) return
  await writeFile(target, withoutBlock(contents, path), 'utf8')
}
