import { join } from 'node:path'
import type { SgNode } from '@ast-grep/napi'
import { readOrNull } from '@/detect/read'
import { functionsIn, nameOf } from '@/structure/functions'
import { parseEach, positionOf, type ParsedSource } from '@/structure/grammar'
import type { BuiltinRequest } from '@/structure/builtin'
import type { StructureFinding, StructureOutcome } from 'types/structure'

export async function fileLengths(request: BuiltinRequest): Promise<StructureOutcome> {
  const findings: StructureFinding[] = []
  const read: string[] = []
  for (const path of request.paths) {
    const source = await readOrNull(join(request.root, path))
    if (source === null) continue
    read.push(path)
    const lines = countLines(source)
    if (lines <= request.limit) continue
    findings.push({
      rule: request.rule,
      path,
      at: { line: request.limit + 1, column: 1 },
      message: `This file is ${lines} lines, against a limit of ${request.limit}.`,
      text: `raise \`${request.setting}\` in gspot.toml, or split the file`,
    })
  }
  return { findings, read, broken: [] }
}

export async function functionLengths(request: BuiltinRequest): Promise<StructureOutcome> {
  const { parsed, broken } = await parseEach(request.root, request.paths)
  const shell = parsed.filter((source) => source.grammar === 'bash')
  return {
    findings: shell.flatMap((source) => longFunctions(source, request)),
    read: shell.map((source) => source.path),
    broken,
  }
}

function longFunctions(source: ParsedSource, request: BuiltinRequest): readonly StructureFinding[] {
  return functionsIn(source)
    .map((node) => ({ node, lines: spanOf(node) }))
    .filter((found) => found.lines > request.limit)
    .map((found) => ({
      rule: request.rule,
      path: source.path,
      at: positionOf(found.node),
      message: `This function is ${found.lines} lines, against a limit of ${request.limit}.`,
      text: `${nameOf(found.node)}, or raise \`${request.setting}\` in gspot.toml`,
      symbol: nameOf(found.node),
    }))
}

function spanOf(node: SgNode): number {
  const range = node.range()
  return range.end.line - range.start.line + 1
}

function countLines(source: string): number {
  const lines = source.split('\n')
  return lines.at(-1) === '' ? lines.length - 1 : lines.length
}
