import { join } from 'node:path'
import type { DriftFinding, GeneratedFile } from 'types/configuration'
import { readOrNull } from '@/detect/read'

export async function findDrift(
  root: string,
  files: readonly GeneratedFile[],
): Promise<readonly DriftFinding[]> {
  const findings: DriftFinding[] = []
  for (const file of files) {
    const written = await readOrNull(join(root, file.path))
    if (written === null) {
      findings.push({
        kind: 'absent',
        path: file.path,
        message: 'is missing. Run `gspot generate` to write it.',
      })
      continue
    }
    if (written === file.contents) continue
    findings.push({
      kind: 'edited',
      path: file.path,
      message:
        'was edited by hand, so the policy and the file disagree.\n' +
        '  Move the change into gspot.toml, or run `gspot generate` to discard it.',
    })
  }
  return findings
}

export function findOrphans(
  files: readonly GeneratedFile[],
  selectedChecks: ReadonlySet<string>,
): readonly DriftFinding[] {
  return files
    .filter((file) => !file.isStub && !file.readers.some((reader) => selectedChecks.has(reader)))
    .map((file) => ({
      kind: 'orphan' as const,
      path: file.path,
      message:
        'is written and read by nothing. Every check that named it is out of the selection.\n' +
        '  Remove the config from the preset, or select a check that reads it.',
    }))
}

export function describeDrift(finding: DriftFinding): string {
  return `${finding.kind.padEnd(12)} ${finding.path} ${finding.message}`
}
