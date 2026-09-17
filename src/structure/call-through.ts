import type { SgNode } from '@ast-grep/napi'
import { optional } from '@/settings/optional'
import { functionKindsOf, functionsIn, nameOf } from '@/structure/functions'
import { parseEach, positionOf, type ParsedSource } from '@/structure/grammar'
import type { BuiltinRequest } from '@/structure/builtin'
import type { StructureFinding, StructureOutcome } from 'types/structure'

const ARGUMENT_DEPTH = 4

const BODY_DEPTH = 5

export async function callThroughs(request: BuiltinRequest): Promise<StructureOutcome> {
  const { parsed, broken } = await parseEach(request.root, request.paths)
  const withFunctions = parsed.filter((source) => functionKindsOf(source.grammar).length > 0)
  return {
    findings: withFunctions.flatMap((source) => passingThrough(source, request.rule)),
    read: withFunctions.map((source) => source.path),
    broken,
  }
}

function passingThrough(source: ParsedSource, rule: string): readonly StructureFinding[] {
  return functionsIn(source)
    .map((fn) => ({ fn, call: onlyCall(fn) }))
    .filter((found) => found.call !== null && passesThrough(found.fn, found.call))
    .map((found) => ({
      rule,
      path: source.path,
      at: positionOf(found.fn),
      message: 'This function passes its own arguments straight through, unchanged.',
      text: 'call the inner function directly, and delete this one',
      ...optional('symbol', nameOf(found.fn)),
    }))
}

export function passesThrough(fn: SgNode, call: SgNode): boolean {
  const taken = parameterNames(fn)
  const passed = argumentNames(call)
  if (passed === null) return false
  return taken.length === passed.length && taken.every((name, at) => name === passed[at])
}

export function parameterNames(fn: SgNode): readonly string[] {
  const children = named(fn)
  const own = children.filter((node) => kind(node).includes('parameter') && !isList(node))
  if (own.length > 0) return own.map((node) => nameIn(node.text()))
  const list = children.find(isList)
  return list === undefined ? [] : named(list).map((node) => nameIn(node.text()))
}

export function nameIn(text: string): string {
  const head = (text.split(':')[0] ?? '').split('=')[0] ?? ''
  const words = head.trim().split(/\s+/u)
  return (words.at(-1) ?? '').replace(/\?$/u, '')
}

export function argumentNames(call: SgNode): readonly string[] | null {
  const list = argumentList(call)
  if (list === null) return []
  const passed = named(list).map(unwrap)
  if (passed.some((node) => !['identifier', 'simple_identifier'].includes(kind(node)))) return null
  return passed.map((node) => node.text())
}

function argumentList(call: SgNode): SgNode | null {
  let node: SgNode | null = call
  for (let depth = 0; node !== null && depth < ARGUMENT_DEPTH; depth += 1) {
    if (isArgumentList(node)) return node
    node = named(node).find(holdsArguments) ?? null
  }
  return null
}

function onlyCall(fn: SgNode): SgNode | null {
  let node = fn.field('body')
  for (let depth = 0; node !== null && depth < BODY_DEPTH; depth += 1) {
    if (['call_expression', 'call'].includes(kind(node))) return node
    const inside = named(node)
    node = inside.length === 1 ? (inside[0] as SgNode) : null
  }
  return null
}

function unwrap(node: SgNode): SgNode {
  const inside = named(node)
  return holdsArguments(node) && inside.length === 1 ? (inside[0] as SgNode) : node
}

function isArgumentList(node: SgNode): boolean {
  return ['arguments', 'argument_list', 'value_arguments'].includes(kind(node))
}

function holdsArguments(node: SgNode): boolean {
  return isArgumentList(node) || kind(node).includes('argument') || kind(node).endsWith('_suffix')
}

function isList(node: SgNode): boolean {
  return kind(node).endsWith('parameters')
}

function named(node: SgNode): readonly SgNode[] {
  return node.children().filter((child) => child.isNamed())
}

function kind(node: SgNode): string {
  return String(node.kind())
}
