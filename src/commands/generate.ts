import { describeDrift, findOrphans } from '@/configuration/drift'

import { checksOf } from '@/settings/policy'
import type { DriftFinding, GeneratedFile } from 'types/configuration'
import type { Policy } from 'types/settings'
import type { GenerateOptions, GenerateOutcome } from 'types/commands'
import { findDrift } from '@/configuration/drift'
import { renderAll, writeAll } from '@/configuration/write'
import { trackedFiles } from '@/coverage/tracked'
import { readPolicy } from '@/settings/policy'

export async function runGenerate(options: GenerateOptions): Promise<GenerateOutcome> {
  const policy = await readPolicy(options.cwd, options.presetsRoot)
  const files = await renderAll({
    presets: policy.presets,
    settings: policy.merged.settings,
    version: options.version,
    stubs: new Set(),
  })

  return options.check ? await compare(policy, files) : await write(policy, files)
}

async function write(policy: Policy, files: readonly GeneratedFile[]): Promise<GenerateOutcome> {
  await writeAll(policy.root, files)
  const lines = files.map((file) => `wrote        ${file.path}`)
  lines.push(...deadEntries(policy))
  lines.push(`generated    ${files.length} file(s) from ${policy.settings.source}`)
  return { files, findings: [], lines, code: 0 }
}

async function compare(policy: Policy, files: readonly GeneratedFile[]): Promise<GenerateOutcome> {
  const tracked = await trackedFiles(policy.root)
  const findings = [
    ...(await findDrift(policy.root, files)),
    ...findOrphans(files, new Set(checksOf(policy).keys())),
    ...missingReferents(files, tracked.paths.map((entry) => entry.path)),
  ]
  const lines = findings.map(describeDrift)
  lines.push(...deadEntries(policy))
  lines.push(`generated    ${files.length} file(s) checked, ${findings.length} problem(s)`)
  return { files, findings, lines, code: findings.length === 0 ? 0 : 1 }
}

function missingReferents(
  files: readonly GeneratedFile[],
  tracked: readonly string[],
): readonly DriftFinding[] {
  const known = new Set(tracked)
  const findings: DriftFinding[] = []
  for (const file of files) {
    for (const referent of referentsIn(file.contents)) {
      if (known.has(referent)) continue
      findings.push({
        kind: 'missing-referent',
        path: file.path,
        message: `names \`${referent}\`, and the repository tracks no such file.`,
      })
    }
  }
  return findings
}

const REFERENT = /["'`](?!https?:)((?:[\w.-]+\/)+[\w.-]+\.[a-z0-9]+)["'`]/giu

function referentsIn(contents: string): readonly string[] {
  return [...contents.matchAll(REFERENT)]
    .map((match) => match[1])
    .filter((path): path is string => path !== undefined && !path.startsWith('.gspot/'))
}

function deadEntries(policy: Policy): readonly string[] {
  return policy.merged.dead.map((entry) => `dead         ${entry.entry.where} ${entry.why}`)
}
