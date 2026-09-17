import type { SgNode } from '@ast-grep/napi'
import { enclosingFunction, functionKindsOf, nameOf } from '@/structure/functions'
import { positionOf } from '@/structure/grammar'
import type { CountMeasure, Position } from 'types/structure'

export type Overflow = {
  readonly at: Position
  readonly count: number
  readonly subject: string
}

export function overflows(
  matches: readonly SgNode[],
  measure: CountMeasure,
  limit: number,
  grammar: string,
): readonly Overflow[] {
  const kinds = functionKindsOf(grammar)
  switch (measure) {
    case 'per-file':
      return above(limit, [{ at: firstPosition(matches), count: matches.length, subject: 'the file' }])
    case 'per-function':
      return above(limit, perFunction(matches, kinds))
    case 'nesting':
      return above(limit, deepest(matches, kinds))
    case 'nodes':
      return above(limit, perMatch(matches))
  }
}

function above(limit: number, groups: readonly Overflow[]): readonly Overflow[] {
  return groups.filter((group) => group.count > limit)
}

function firstPosition(matches: readonly SgNode[]): Position {
  const first = matches[0]
  return first === undefined ? { line: 1, column: 1 } : positionOf(first)
}

function perFunction(matches: readonly SgNode[], kinds: readonly string[]): readonly Overflow[] {
  const groups = new Map<string, { owner: SgNode; count: number }>()
  for (const match of matches) {
    const owner = enclosingFunction(match, kinds)
    if (owner === null) continue
    const key = keyOf(owner)
    groups.set(key, { owner, count: (groups.get(key)?.count ?? 0) + 1 })
  }
  return [...groups.values()].map((group) => ({
    at: positionOf(group.owner),
    count: group.count,
    subject: nameOf(group.owner),
  }))
}

function deepest(matches: readonly SgNode[], kinds: readonly string[]): readonly Overflow[] {
  const found = new Set(matches.map(keyOf))
  const groups = new Map<string, Overflow>()
  for (const match of matches) {
    const owner = enclosingFunction(match, kinds)
    if (owner === null) continue
    const key = keyOf(owner)
    const depth = depthOf(match, found, kinds)
    const existing = groups.get(key)
    if (existing !== undefined && existing.count >= depth) continue
    groups.set(key, { at: positionOf(owner), count: depth, subject: nameOf(owner) })
  }
  return [...groups.values()]
}

function depthOf(match: SgNode, found: ReadonlySet<string>, kinds: readonly string[]): number {
  let depth = 1
  let node = match.parent()
  while (node !== null && !kinds.includes(String(node.kind()))) {
    if (found.has(keyOf(node))) depth += 1
    node = node.parent()
  }
  return depth
}

function perMatch(matches: readonly SgNode[]): readonly Overflow[] {
  return matches.map((match) => ({
    at: positionOf(match),
    count: size(match),
    subject: nameOf(match),
  }))
}

function size(node: SgNode): number {
  let total = 1
  for (const child of node.children()) total += size(child)
  return total
}

export function symbolOf(node: SgNode, grammar: string): string | null {
  const own = node.field('name')
  if (own !== null) return own.text()
  const owner = enclosingFunction(node, functionKindsOf(grammar))
  return owner === null ? null : nameOf(owner)
}

function keyOf(node: SgNode): string {
  const range = node.range()
  return `${range.start.index}:${range.end.index}`
}
