import { join } from 'node:path'
import { parse, registerDynamicLanguage } from '@ast-grep/napi'
import type { SgNode, SgRoot } from '@ast-grep/napi'
import {
  BROKEN_NODE_KINDS,
  DYNAMIC_LANGUAGES,
  GRAMMAR_BY_EXTENSION,
  GRAMMAR_BY_INTERPRETER,
  PARSE_FAILURE_CONTEXT,
} from '@config/structure'
import { extensionOf } from '@/detect/extension'
import { interpreterOf } from '@/detect/interpreter'
import { readOrNull } from '@/detect/read'
import type { BrokenSource, Position } from 'types/structure'

let registered = false

export async function registerGrammars(): Promise<void> {
  if (registered) return
  const packages: Record<string, unknown> = {}
  for (const language of DYNAMIC_LANGUAGES) {
    packages[language] = (await import(`@ast-grep/lang-${language}`)).default
  }
  registerDynamicLanguage(packages as Parameters<typeof registerDynamicLanguage>[0])
  registered = true
}

export function grammarFor(path: string, interpreter: string | null = null): string | null {
  const extension = extensionOf(path)
  if (extension !== '') return GRAMMAR_BY_EXTENSION[extension] ?? null
  return interpreter === null ? null : (GRAMMAR_BY_INTERPRETER[interpreter] ?? null)
}

export type Parsed =
  | { readonly outcome: 'read'; readonly root: SgRoot }
  | { readonly outcome: 'broken'; readonly broken: BrokenSource }

export function parseSource(path: string, grammar: string, source: string): Parsed {
  const root = parse(grammar, source)
  const broken = firstBroken(root.root(), path, source)
  return broken === null ? { outcome: 'read', root } : { outcome: 'broken', broken }
}

function firstBroken(node: SgNode, path: string, source: string): BrokenSource | null {
  if (BROKEN_NODE_KINDS.includes(String(node.kind()))) return describeBroken(node, path, source)
  for (const child of node.children()) {
    const broken = firstBroken(child, path, source)
    if (broken !== null) return broken
  }
  return null
}

function describeBroken(node: SgNode, path: string, source: string): BrokenSource {
  const range = node.range()
  return {
    path,
    at: { line: range.start.line + 1, column: range.start.column + 1 },
    offset: range.start.index,
    kind: String(node.kind()),
    text: quote(source, range.start.index),
  }
}

function quote(source: string, offset: number): string {
  const from = Math.max(0, offset - PARSE_FAILURE_CONTEXT)
  const to = Math.min(source.length, offset + PARSE_FAILURE_CONTEXT)
  return source.slice(from, to).replace(/\n/gu, ' ').trim()
}

export function describeParseFailure(broken: BrokenSource): string {
  return (
    `${broken.path}:${broken.at.line}:${broken.at.column}  the grammar could not read this source\n` +
    `  byte ${broken.offset}, node ${broken.kind}\n` +
    `  ${broken.text}\n` +
    '  A parse error hides every rule after it, so it fails rather than returning nothing.'
  )
}

export function positionOf(node: SgNode): Position {
  const range = node.range()
  return { line: range.start.line + 1, column: range.start.column + 1 }
}

export type ParsedSource = {
  readonly path: string
  readonly grammar: string
  readonly root: SgRoot
  readonly source: string
}

export type ParsedSources = {
  readonly parsed: readonly ParsedSource[]
  readonly broken: readonly BrokenSource[]
}

export async function parseEach(root: string, paths: readonly string[]): Promise<ParsedSources> {
  await registerGrammars()
  const parsed: ParsedSource[] = []
  const broken: BrokenSource[] = []

  for (const path of paths) {
    const grammar = await grammarIn(root, path)
    if (grammar === null) continue
    const source = await readOrNull(join(root, path))
    if (source === null) continue

    const read = parseSource(path, grammar, source)
    if (read.outcome === 'broken') broken.push(read.broken)
    else parsed.push({ path, grammar, root: read.root, source })
  }
  return { parsed, broken }
}

export async function grammarIn(root: string, path: string): Promise<string | null> {
  const byName = grammarFor(path)
  if (byName !== null || extensionOf(path) !== '') return byName
  const source = await readOrNull(join(root, path))
  if (source === null) return null
  return grammarFor(path, interpreterOf(source.split('\n', 1)[0] ?? ''))
}
