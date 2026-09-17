import picomatch from 'picomatch'
import type { IgnorePattern, IgnoreVerdict } from 'types/coverage'

export function readIgnoreFile(text: string, source: string): readonly IgnorePattern[] {
  const patterns: IgnorePattern[] = []
  text.split('\n').forEach((raw, index) => {
    const pattern = readPattern(raw, source, index + 1)
    if (pattern !== null) patterns.push(pattern)
  })
  return patterns
}

function readPattern(raw: string, source: string, line: number): IgnorePattern | null {
  const trimmed = stripTrailingSpace(raw)
  if (trimmed.length === 0 || trimmed.startsWith('#')) return null

  const negated = trimmed.startsWith('!')
  const unsigned = negated ? trimmed.slice(1) : trimmed
  const body = unsigned.startsWith('\\#') || unsigned.startsWith('\\!') ? unsigned.slice(1) : unsigned
  if (body.length === 0) return null

  const directoryOnly = body.endsWith('/')
  const bare = directoryOnly ? body.slice(0, -1) : body
  return { text: trimmed, source, line, negated, directoryOnly, matches: compile(bare) }
}

function stripTrailingSpace(raw: string): string {
  const line = raw.replace(/\r$/u, '')
  const kept = /(?:^|[^\\])(?:\\\\)*\\ $/u.test(line)
  return kept ? line : line.replace(/\s+$/u, '')
}

function compile(bare: string): (path: string) => boolean {
  const anchored = bare.startsWith('/')
  const body = normaliseClasses(anchored ? bare.slice(1) : bare)
  const interior = body.slice(0, -1).includes('/')
  const glob = anchored || interior ? body : `**/${body}`
  const isMatch = picomatch(glob, { dot: true })
  const isMatchUnder = picomatch(`${glob}/**`, { dot: true })
  return (path: string) => isMatch(path) || isMatchUnder(path)
}

function normaliseClasses(pattern: string): string {
  let translated = ''
  let at = 0
  while (at < pattern.length) {
    const character = pattern[at]
    if (character === '\\') {
      translated += pattern.slice(at, at + 2)
      at += 2
      continue
    }
    if (character !== '[') {
      translated += character
      at += 1
      continue
    }
    const closed = closingBracket(pattern, at)
    if (closed === -1) {
      translated += '\\['
      at += 1
      continue
    }
    translated += `[${negation(pattern[at + 1])}${pattern.slice(at + 2, closed + 1)}`
    at = closed + 1
  }
  return translated
}

function negation(first: string | undefined): string {
  return first === '!' || first === '^' ? '^' : (first ?? '')
}

function closingBracket(pattern: string, open: number): number {
  let at = open + 1
  if (pattern[at] === '!' || pattern[at] === '^') at += 1
  if (pattern[at] === ']') at += 1
  for (; at < pattern.length; at += 1) {
    if (pattern[at] === '\\') {
      at += 1
      continue
    }
    if (pattern[at] === ']') return at
  }
  return -1
}

export function judge(patterns: readonly IgnorePattern[], path: string): IgnoreVerdict | null {
  const segments = path.split('/')
  for (let depth = 1; depth < segments.length; depth += 1) {
    const directory = segments.slice(0, depth).join('/')
    const verdict = decide(patterns, directory, true)
    if (verdict?.ignored === true) return verdict
  }
  return decide(patterns, path, false)
}

export function ignores(patterns: readonly IgnorePattern[], path: string): boolean {
  return judge(patterns, path)?.ignored === true
}

export function decide(
  patterns: readonly IgnorePattern[],
  path: string,
  isDirectory: boolean,
): IgnoreVerdict | null {
  let verdict: IgnoreVerdict | null = null
  for (const pattern of patterns) {
    if (pattern.directoryOnly && !isDirectory) continue
    if (!pattern.matches(path)) continue
    verdict = { ignored: !pattern.negated, pattern, at: path }
  }
  return verdict
}
