import type { SgNode } from '@ast-grep/napi'
import { TRIVIAL_BODY_NODES } from '@config/structure'
import { functionKindsOf, functionsIn, nameOf } from '@/structure/functions'
import { parseEach, positionOf, type ParsedSource } from '@/structure/grammar'
import type { BuiltinRequest } from '@/structure/builtin'
import type { Position, StructureFinding, StructureOutcome } from 'types/structure'

type Body = { readonly path: string; readonly at: Position; readonly symbol: string }

export async function duplicateFunctions(request: BuiltinRequest): Promise<StructureOutcome> {
  const { parsed, broken } = await parseEach(request.root, request.paths)
  const withFunctions = parsed.filter((source) => functionKindsOf(source.grammar).length > 0)
  const bodies = new Map<string, Body[]>()
  for (const source of withFunctions) index(bodies, source)
  return {
    findings: repeated(bodies, request),
    read: withFunctions.map((source) => source.path),
    broken,
  }
}

function index(bodies: Map<string, Body[]>, source: ParsedSource): void {
  for (const fn of functionsIn(source)) {
    const body = fn.field('body')
    if (body === null) continue
    const shape = normalise(body)

    if (size(body) <= TRIVIAL_BODY_NODES) continue
    const at = { path: source.path, at: positionOf(fn), symbol: nameOf(fn) }
    bodies.set(shape, [...(bodies.get(shape) ?? []), at])
  }
}

function repeated(
  bodies: ReadonlyMap<string, readonly Body[]>,
  request: BuiltinRequest,
): readonly StructureFinding[] {
  const findings: StructureFinding[] = []
  for (const copies of bodies.values()) {
    if (copies.length < request.limit) continue
    const named = copies.map((copy) => `${copy.path}:${copy.at.line} ${copy.symbol}`).join(', ')
    for (const copy of copies) {
      findings.push({
        rule: request.rule,
        path: copy.path,
        at: copy.at,
        message:
          `This body appears ${copies.length} times, and ${request.limit} copies is a ` +
          'concept that was never given a name.',
        text: named,
        symbol: copy.symbol,
      })
    }
  }
  return findings
}

function normalise(body: SgNode): string {
  if (body.isNamedLeaf()) return String(body.kind())
  const inside = body.children().filter((node) => node.isNamed() && !String(node.kind()).includes('comment'))
  if (inside.length === 0) return `${body.kind()}(${body.text().trim()})`
  return `${body.kind()}(${inside.map(normalise).join(' ')})`
}

function size(node: SgNode): number {
  let total = node.isNamed() ? 1 : 0
  for (const child of node.children()) total += size(child)
  return total
}
