import { EMPTY_REASON } from '@config/presets'
import { compileSelector } from '@/settings/selector'
import { optionalString, requiredString, stringList, tableList, type Table } from '@/settings/toml'

import type { Declaration, Exception, Suppressible } from 'types/settings'
import type { Selector } from 'types/paths'
import { optional } from '@/settings/optional'

export function readDeclarations(document: Table, source: string): readonly Declaration[] {
  return tableList(document, 'declare', source).map((entry, position) => {
    const where = `${source} [[declare]] ${position}`
    const producedBy = optionalString(entry, 'produced_by', where)
    const reason = optionalString(entry, 'reason', where)
    assertOneAnswer(producedBy, reason, where)
    return {
      paths: compileSelector(requiredPaths(entry, where), `${where} paths`),
      ...(producedBy === undefined ? {} : { producedBy }),
      ...(reason === undefined ? {} : { reason }),
    }
  })
}

function assertOneAnswer(producedBy: string | undefined, reason: string | undefined, where: string): void {
  if (producedBy !== undefined && reason !== undefined) {
    throw new Error(
      `${where}: carries both \`produced_by\` and \`reason\`.\n` +
        '  `produced_by` means a task writes the file, so gspot runs it and diffs the result.\n' +
        '  `reason` alone means nobody here writes the file. A path is one or the other.',
    )
  }
  if (producedBy === undefined && reason === undefined) {
    throw new Error(
      `${where}: says nothing about the path.\n` +
        '  Add `produced_by` when a task writes it, or `reason` when it is not this project to fix.',
    )
  }
}

export function readExceptions(document: Table, source: string): readonly Exception[] {
  return tableList(document, 'exception', source).map((entry, position) => {
    const where = `${source} [[exception]] ${position}`
    const check = requiredString(entry, 'check', where)
    const at = `${where} (${check})`
    const paths = stringList(entry, 'paths', at)
    return {
      check,
      reason: requiredReason(entry, at),
      ...optional('rule', optionalString(entry, 'rule', at)),
      ...(paths.length === 0 ? {} : { paths: compileSelector(paths, `${at} paths`) }),
      ...optional('symbol', optionalString(entry, 'symbol', at)),
      ...optional('finding', optionalString(entry, 'finding', at)),
    }
  })
}

function requiredReason(entry: Table, where: string): string {
  const reason = requiredString(entry, 'reason', where)
  const empty = reason.trim().length === 0 || EMPTY_REASON.test(reason.trim())
  if (empty) {
    throw new Error(
      `${where}: the reason reads \`${reason}\`, which says nothing.\n` +
        '  Every exception is printed in every run report. Write the sentence somebody will read.',
    )
  }
  return reason
}

function requiredPaths(entry: Table, where: string): readonly string[] {
  const paths = stringList(entry, 'paths', where)
  if (paths.length === 0) throw new Error(`${where}: names no paths.`)
  return paths
}

export function declarationFor(
  declarations: readonly Declaration[],
  path: string,
): Declaration | undefined {
  return declarations.find((entry) => entry.paths.matches(path))
}

export function exceptionFor(
  exceptions: readonly Exception[],
  target: Suppressible,
): Exception | undefined {
  return exceptions.find((entry) => covers(entry, target))
}

function covers(entry: Exception, target: Suppressible): boolean {
  if (entry.check !== target.check) return false
  if (entry.paths !== undefined && !matchesPath(entry.paths, target.path)) return false
  if (entry.rule !== undefined && entry.rule !== target.rule) return false
  if (entry.symbol !== undefined && entry.symbol !== target.symbol) return false
  if (entry.finding !== undefined && entry.finding !== target.finding) return false
  return true
}

function matchesPath(paths: Selector, path: string | undefined): boolean {
  return path !== undefined && paths.matches(path)
}

export function disablesCheck(entry: Exception): boolean {
  return entry.paths === undefined && entry.rule === undefined && entry.symbol === undefined && entry.finding === undefined
}
