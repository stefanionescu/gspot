import { parse, type NapiConfig } from '@ast-grep/napi'
import { optional } from '@/settings/optional'
import { overflows, symbolOf } from '@/structure/counter'
import { firstLineOf } from '@/structure/functions'
import { grammarIn, parseEach, positionOf, registerGrammars, type ParsedSource } from '@/structure/grammar'
import type { CountMeasure, StructureFinding, StructureOutcome, StructureRule } from 'types/structure'

export type EngineRequest = {
  readonly root: string
  readonly paths: readonly string[]
  readonly rules: readonly StructureRule[]

  readonly count?: ResolvedCount
}

export type ResolvedCount = {
  readonly measure: CountMeasure
  readonly limit: number

  readonly setting: string
}

export async function runStructure(request: EngineRequest): Promise<StructureOutcome> {
  await registerGrammars()
  for (const rule of request.rules) assertRuns(rule)
  const byGrammar = groupByGrammar(request.rules)
  const { parsed, broken } = await parseEach(request.root, request.paths)
  const mine = parsed.filter((source) => byGrammar.has(source.grammar))
  return {
    findings: mine.flatMap((source) =>
      (byGrammar.get(source.grammar) ?? []).flatMap((rule) => findingsFor(rule, source, request.count)),
    ),
    read: mine.map((source) => source.path),
    broken,
  }
}

export function assertRuns(rule: StructureRule): void {
  try {
    parse(rule.language, '').root().findAll(configFor(rule))
  } catch (reason) {
    throw new Error(
      `${rule.source}: ast-grep will not run this rule.\n` +
        `  ${(reason as Error).message.split('\n').join('\n  ')}\n` +
        '  See https://ast-grep.github.io/reference/rule.html for the shape of a rule.',
    )
  }
}

function groupByGrammar(rules: readonly StructureRule[]): ReadonlyMap<string, StructureRule[]> {
  const byGrammar = new Map<string, StructureRule[]>()
  for (const rule of rules) {
    const existing = byGrammar.get(rule.language) ?? []
    existing.push(rule)
    byGrammar.set(rule.language, existing)
  }
  return byGrammar
}

function findingsFor(
  rule: StructureRule,
  source: ParsedSource,
  count: ResolvedCount | undefined,
): readonly StructureFinding[] {
  const { path, grammar } = source
  const matches = source.root.root().findAll(configFor(rule))
  if (count === undefined) {
    return matches.map((node) => ({
      rule: rule.id,
      path,
      at: positionOf(node),
      message: rule.message,
      text: firstLineOf(node),
      ...optional('symbol', symbolOf(node, grammar)),
    }))
  }
  return overflows(matches, count.measure, count.limit, grammar).map((over) => ({
    rule: rule.id,
    path,
    at: over.at,
    message: `${rule.message} ${over.count} against a limit of ${count.limit}.`,
    text: `${over.subject}, raise \`${count.setting}\` in gspot.toml to allow it`,
    ...optional('symbol', over.subject),
  }))
}

export function configFor(rule: StructureRule): NapiConfig {
  return {
    rule: rule.rule,
    ...(rule.constraints === undefined ? {} : { constraints: rule.constraints }),
    ...(rule.utils === undefined ? {} : { utils: rule.utils }),
  } as NapiConfig
}

export async function coveredPaths(
  root: string,
  paths: readonly string[],
  rules: readonly StructureRule[],
): Promise<readonly string[]> {
  const byGrammar = groupByGrammar(rules)
  const covered: string[] = []
  for (const path of paths) {
    const grammar = await grammarIn(root, path)
    if (grammar !== null && byGrammar.has(grammar)) covered.push(path)
  }
  return covered
}

export function describeFinding(finding: StructureFinding): string {
  const at = `${finding.path}:${finding.at.line}:${finding.at.column}`
  const named = finding.symbol === undefined ? '' : ` [${finding.symbol}]`
  return `${at}  ${finding.rule}${named}  ${finding.message}`
}
