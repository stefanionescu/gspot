import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BASELINE_DIRECTORY } from '@config/paths'
import { NEVER_BASELINED } from '@config/gate'
import type { Inspection } from 'types/manifest'
import type { Baseline, BaselineVerdict } from 'types/run'

export function slugOf(rule: string): string {
  return rule
    .toLowerCase()
    .replace(/\//gu, '__')
    .replace(/[^a-z0-9_-]+/gu, '-')
    .replace(/^[-_]+|[-_]+$/gu, '')
}

export async function readBaselines(root: string): Promise<ReadonlyMap<string, Baseline>> {
  const directory = join(root, BASELINE_DIRECTORY)
  const baselines = new Map<string, Baseline>()
  for (const name of await listJson(directory)) {
    const baseline = JSON.parse(await readFile(join(directory, name), 'utf8')) as Baseline
    baselines.set(baseline.rule, baseline)
  }
  return baselines
}

async function listJson(directory: string): Promise<readonly string[]> {
  try {
    return (await readdir(directory)).filter((name) => name.endsWith('.json')).sort()
  } catch {
    return []
  }
}

export function baselineRefusedFor(inspects: readonly Inspection[]): Inspection | null {
  return inspects.find((inspection) => NEVER_BASELINED.includes(inspection)) ?? null
}

export async function writeBaseline(root: string, baseline: Baseline): Promise<void> {
  const directory = join(root, BASELINE_DIRECTORY)
  await mkdir(directory, { recursive: true })
  const target = join(directory, `${slugOf(baseline.rule)}.json`)
  await writeFile(target, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8')
}

export function judgeBaseline(
  baseline: Baseline,
  count: number,
  perPath: Readonly<Record<string, number>>,
): BaselineVerdict {
  const grew = Object.entries(perPath)
    .filter(([path, found]) => found > (baseline.paths[path] ?? 0))
    .map(([path]) => path)
  return {
    rule: baseline.rule,
    baseline: baseline.count,
    count,
    grew,
    exceeded: count > baseline.count || grew.length > 0,
  }
}

export function staleEntries(baseline: Baseline, tracked: ReadonlySet<string>): readonly string[] {
  return Object.keys(baseline.paths).filter((path) => !tracked.has(path))
}
