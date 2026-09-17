import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { declarationFor } from '@/settings/declaration'
import { attributesOf } from '@/coverage/attribute'

import type { Declaration } from 'types/settings'
import type { Classification } from 'types/coverage'
import type { ClassifyInputs } from 'types/measure'
import { BANNER_SEARCH_LINES, BINARY_SNIFF_BYTES } from '@config/limits'
import { optional } from '@/settings/optional'

export async function classify(path: string, inputs: ClassifyInputs): Promise<Classification> {
  const declared = declarationFor(inputs.declarations, path)
  if (declared !== undefined) return fromDeclaration(path, declared)
  if (inputs.frozen.has(path)) return { path, nature: 'frozen', from: 'declaration' }

  const attributes = attributesOf(inputs.attributes, path)
  if (attributes.generated) return { path, nature: 'generated', from: 'attribute' }
  if (attributes.vendored) return { path, nature: 'vendored', from: 'attribute' }
  if (attributes.notText || attributes.filter === 'lfs') {
    return { path, nature: 'binary', from: 'attribute' }
  }

  const head = await readHead(join(inputs.root, path))
  if (head === null || head.includes(0)) return { path, nature: 'binary', from: 'content' }
  if (hasBanner(head.toString('utf8'), inputs.banners)) {
    return { path, nature: 'generated', from: 'banner' }
  }
  return { path, nature: 'source', from: 'default' }
}

export async function classifyAll(
  paths: readonly string[],
  inputs: ClassifyInputs,
): Promise<readonly Classification[]> {
  const classifications: Classification[] = []
  for (const path of paths) classifications.push(await classify(path, inputs))
  return classifications
}

function fromDeclaration(path: string, declared: Declaration): Classification {
  return declared.producedBy === undefined
    ? { path, nature: 'vendored', from: 'declaration', ...optional('reason', declared.reason) }
    : { path, nature: 'generated', from: 'declaration', producedBy: declared.producedBy }
}

async function readHead(absolute: string): Promise<Buffer | null> {
  try {
    const contents = await readFile(absolute)
    return contents.subarray(0, BINARY_SNIFF_BYTES)
  } catch {
    return null
  }
}

function hasBanner(head: string, banners: readonly string[]): boolean {
  if (banners.length === 0) return false
  const front = head.split('\n', BANNER_SEARCH_LINES).join('\n')
  return banners.some((banner) => front.includes(banner))
}
