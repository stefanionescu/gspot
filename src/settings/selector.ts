import picomatch from 'picomatch'
import type { Selector } from 'types/paths'

type Rule = { readonly negated: boolean; readonly test: (path: string) => boolean }

export function compileSelector(patterns: readonly string[], where: string): Selector {
  const rules: Rule[] = []
  patterns.forEach((pattern, position) => {
    const negated = pattern.startsWith('!')
    const body = negated ? pattern.slice(1) : pattern
    reject(body, negated, position, where)
    rules.push({ negated, test: picomatch(body, { dot: true }) })
  })
  return { matches: (path) => decide(rules, path), patterns }
}

function decide(rules: readonly Rule[], path: string): boolean {
  let included = false
  for (const rule of rules) {
    if (rule.test(path)) included = !rule.negated
  }
  return included
}

function reject(body: string, negated: boolean, position: number, where: string): void {
  if (negated && position === 0) {
    fail(where, body, 'A negation cannot come first. Include paths, then exclude from them.')
  }
  if (body.length === 0) {
    fail(where, body, 'An empty pattern matches nothing and hides the mistake.')
  }
  if (body.startsWith('/')) {
    fail(where, body, 'Patterns are root-relative already. Drop the leading slash.')
  }
  if (body.startsWith('./') || body.startsWith('../') || body.includes('/../')) {
    fail(where, body, 'Patterns are root-relative. Write the path from the repository root.')
  }
  if (body.endsWith('/')) {
    fail(
      where,
      body,
      'A bare directory name is not a pattern here. Write `' +
        body +
        '**` to mean every path under it.\n' +
        '  Under gitignore semantics `sql/` matches any directory named sql at any depth,\n' +
        '  which is how one line hid 58 of 83 SQL files in the repository this rule comes from.',
    )
  }
}

function fail(where: string, pattern: string, reason: string): never {
  throw new Error(`${where}: cannot read the path selector \`${pattern}\`.\n  ${reason}`)
}
