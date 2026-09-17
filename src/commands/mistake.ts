export function unknownCommand(typed: string, known: readonly string[]): readonly string[] {
  const lines = [`unknown command "${typed}"`]
  const near = closest(typed, known)
  if (near !== null) lines.push(`did you mean: ${near}`)
  lines.push('run gspot --help for the list')
  return lines
}

function closest(typed: string, known: readonly string[]): string | null {
  let best: string | null = null
  let shortest = Math.max(2, Math.floor(typed.length / 2))
  for (const candidate of known) {
    const apart = distance(typed, candidate)
    if (apart > shortest) continue
    shortest = apart
    best = candidate
  }
  return best
}

function distance(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, at) => at)
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row]
    for (let column = 1; column <= right.length; column += 1) {
      const swap = left[row - 1] === right[column - 1] ? 0 : 1
      current[column] = Math.min(
        (current[column - 1] ?? 0) + 1,
        (previous[column] ?? 0) + 1,
        (previous[column - 1] ?? 0) + swap,
      )
    }
    previous = current
  }
  return previous[right.length] ?? right.length
}
