import { dirname, join } from 'node:path'

import type { Preset } from 'types/manifest'
import { mergeSettings, readEntries } from '@/settings/merge'
import { select } from '@/settings/selection'
import { LOCAL_SETTINGS_FILE, SETTINGS_FILE } from '@config/paths'
import type { Policy, ScopeSelection } from 'types/settings'
import type { MeasureInputs } from 'types/measure'
import { repositoryRoot } from '@/coverage/tracked'

import { readPresets } from '@/settings/selection'
import { readLocalSettings, readSettings } from '@/settings/document'

export async function readPolicy(cwd: string, presetsRoot: string): Promise<Policy> {
  const root = await repositoryRoot(cwd)
  const settings = await readSettings(join(root, SETTINGS_FILE))
  const available = await readPresets(presetsRoot)

  const rootScope: ScopeSelection = {
    path: '',
    presets: select(available, settings.presets, `${settings.source} presets`).presets,
  }
  const scopes = [
    rootScope,
    ...settings.scopes.map((scope) => ({
      path: scope.path,
      presets: select(available, scope.presets, `${settings.source} [[scope]] ${scope.path}`).presets,
    })),
  ]

  const presets = deduplicate(scopes)
  const local = await readLocalSettings(join(root, LOCAL_SETTINGS_FILE))
  return {
    root,
    settings,
    scopes,
    presets,
    merged: mergeSettings(presets, readEntries(settings.tables, settings.source, '')),
    localSkips: new Set(local.skip),
  }
}

function deduplicate(scopes: readonly ScopeSelection[]): readonly Preset[] {
  const presets: Preset[] = []
  const seen = new Set<string>()
  for (const scope of scopes) {
    for (const preset of scope.presets) {
      if (seen.has(preset.id)) continue
      seen.add(preset.id)
      presets.push(preset)
    }
  }
  return presets
}

export function configArgsOf(policy: Policy): ReadonlyMap<string, readonly string[]> {
  const args = new Map<string, readonly string[]>()
  for (const preset of policy.presets) {
    for (const check of preset.checks) {
      if (check.configArg === undefined) continue
      const artifact = preset.configs.find((config) => config.readers.includes(check.id))
      if (artifact === undefined) {
        throw new Error(
          `${preset.source}: check \`${check.id}\` names \`${check.configArg}\` and no [[configs]] ` +
            'entry lists it as a reader, so there is no file to point it at.',
        )
      }
      args.set(check.id, [check.configArg, artifact.target])
    }
  }
  return args
}

export function ruleSetsOf(policy: Policy): ReadonlyMap<string, string> {
  const directories = new Map<string, string>()
  for (const preset of policy.presets) {
    for (const check of preset.checks) {
      if (check.rules === undefined) continue
      directories.set(check.id, join(dirname(preset.source), check.rules))
    }
  }
  return directories
}

export function checksOf(policy: Policy): ReadonlyMap<string, string> {
  const checks = new Map<string, string>()
  for (const preset of policy.presets) {
    for (const check of preset.checks) checks.set(check.id, preset.id)
  }
  for (const consumer of policy.settings.checks) {
    checks.set(consumer.check.id, policy.settings.source)
  }
  return checks
}

export function sweepOf(policy: Policy): MeasureInputs {
  return {
    root: policy.root,
    settings: policy.settings,
    scopes: policy.scopes,
    frozen: new Set(),
    banners: [],
    configArgs: configArgsOf(policy),
    ruleSets: ruleSetsOf(policy),
  }
}
