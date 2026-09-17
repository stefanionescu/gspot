import type { SgNode } from '@ast-grep/napi'
import { FUNCTION_KINDS_BY_GRAMMAR } from '@config/structure'
import type { ParsedSource } from '@/structure/grammar'

export function functionKindsOf(grammar: string): readonly string[] {
  return FUNCTION_KINDS_BY_GRAMMAR[grammar] ?? []
}

export function functionsIn(source: ParsedSource): readonly SgNode[] {
  return nodesOfKind(source.root.root(), functionKindsOf(source.grammar))
}

export function nodesOfKind(node: SgNode, kinds: readonly string[]): readonly SgNode[] {
  if (kinds.length === 0) return []
  return node.findAll({ rule: { any: kinds.map((kind) => ({ kind })) } })
}

export function nameOf(node: SgNode): string {
  const named = node.field('name')
  return named === null ? firstLineOf(node) : named.text()
}

export function firstLineOf(node: SgNode): string {
  return node.text().split('\n')[0]?.trim() ?? ''
}

export function enclosingFunction(node: SgNode, kinds: readonly string[]): SgNode | null {
  let parent = node.parent()
  while (parent !== null) {
    if (kinds.includes(String(parent.kind()))) return parent
    parent = parent.parent()
  }
  return null
}
