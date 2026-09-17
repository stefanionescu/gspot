import { SUPPRESSION_FORMS, SUPPRESSION_REASON } from '@config/suppressions'
import type { Suppression } from 'types/run'

export function findSuppressions(path: string, contents: string): readonly Suppression[] {
  const found: Suppression[] = []
  contents.split('\n').forEach((line, index) => {
    for (const form of SUPPRESSION_FORMS) {
      const match = form.pattern.exec(line)
      if (match === null) continue
      found.push({
        form: form.name,
        path,
        line: index + 1,
        text: line.trim(),
        reason: reasonIn(match[1] ?? ''),
        owned: form.owned,
      })
      break
    }
  })
  return found
}

function reasonIn(tail: string): string | null {
  const found = SUPPRESSION_REASON.exec(tail)?.[1]
  return found === undefined || found.length === 0 ? null : found
}

export function unreasoned(suppressions: readonly Suppression[]): readonly Suppression[] {
  return suppressions.filter((entry) => !entry.owned && entry.reason === null)
}

export function countByForm(
  suppressions: readonly Suppression[],
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>()
  for (const entry of suppressions) {
    counts.set(entry.form, (counts.get(entry.form) ?? 0) + 1)
  }
  return counts
}
