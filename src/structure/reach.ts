import { SHELL_CALL_PATTERN } from '@config/structure'
import { functionsIn } from '@/structure/functions'
import { parseEach, positionOf, type ParsedSource } from '@/structure/grammar'
import type { BuiltinRequest } from '@/structure/builtin'
import type { Position, StructureFinding, StructureOutcome } from 'types/structure'

type Declared = { readonly name: string; readonly path: string; readonly at: Position }

export async function unusedFunctions(request: BuiltinRequest): Promise<StructureOutcome> {
  const checked = new Set(request.paths)

  const beyond = request.entryPoints.filter((path) => !checked.has(path))
  const { parsed, broken } = await parseEach(request.root, [...checked, ...beyond])

  const bodies = new Map(parsed.map((source) => [source.path, source.source]))
  const mine = parsed.filter((source) => checked.has(source.path))
  return {
    findings: unreached(mine.flatMap(declarationsIn), bodies, request.rule),
    read: mine.map((source) => source.path),

    broken: broken.filter((entry) => checked.has(entry.path)),
  }
}

function declarationsIn(source: ParsedSource): readonly Declared[] {
  return functionsIn(source)
    .map((node) => ({ node, named: node.field('name') }))
    .filter((found) => found.named !== null)
    .map((found) => ({
      name: (found.named as NonNullable<typeof found.named>).text(),
      path: source.path,
      at: positionOf(found.node),
    }))
}

function unreached(
  declared: readonly Declared[],
  bodies: ReadonlyMap<string, string>,
  rule: string,
): readonly StructureFinding[] {
  const sources = [...bodies.values()]
  return declared
    .filter((entry) => uses(sources, entry.name) === 0)
    .map((entry) => ({
      rule,
      path: entry.path,
      at: entry.at,
      message: `Nothing calls \`${entry.name}\`.`,
      text: 'delete it, or add the file that calls it to `entry_points`',
      symbol: entry.name,
    }))
}

function uses(sources: readonly string[], name: string): number {
  const pattern = new RegExp(SHELL_CALL_PATTERN.source.replace('NAME', escape(name)), 'gu')
  let total = 0
  for (const source of sources) {
    for (const match of source.matchAll(pattern)) {
      if (declaresItself(source, match.index)) continue
      total += 1
    }
  }
  return total
}

function declaresItself(source: string, index: number): boolean {
  const start = source.lastIndexOf('\n', index) + 1
  const end = source.indexOf('\n', index)
  const line = source.slice(start, end === -1 ? undefined : end)
  return /^\s*(function\s+)?[A-Za-z_][A-Za-z0-9_]*\s*(\(\s*\))?\s*\{/u.test(line)
}

function escape(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}
