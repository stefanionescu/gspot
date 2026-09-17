import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Preset } from 'types/manifest'

import { PRESET_MANIFEST_NAME } from '@config/paths'
import { IMPLIED_BY_A_LANGUAGE } from '@config/presets'
import type { Selection } from 'types/settings'
import { readPreset } from '@/settings/preset'

export async function readPresets(root: string): Promise<ReadonlyMap<string, Preset>> {
  const presets = new Map<string, Preset>()
  for (const path of await manifestPaths(root)) {
    const preset = await readPreset(path)
    const existing = presets.get(preset.id)
    if (existing !== undefined) {
      throw new Error(`${preset.id} is declared twice: ${existing.source} and ${preset.source}.`)
    }
    presets.set(preset.id, preset)
  }
  return presets
}

async function manifestPaths(root: string): Promise<readonly string[]> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && entry.name === PRESET_MANIFEST_NAME)
    .map((entry) => join(entry.parentPath, entry.name))
    .sort()
}

export function select(
  available: ReadonlyMap<string, Preset>,
  wanted: readonly string[],
  where: string,
): Selection {
  const asked = new Set(wanted)
  const implied: string[] = []
  const ordered: Preset[] = []
  const seen = new Set<string>()

  for (const id of [...wanted, ...impliedBy(available, wanted, asked)]) {
    if (!asked.has(id)) implied.push(id)
    add(available, id, ordered, seen, where, [])
  }
  assertNoConflict(ordered, where)
  return { presets: ordered, implied }
}

function impliedBy(
  available: ReadonlyMap<string, Preset>,
  wanted: readonly string[],
  asked: ReadonlySet<string>,
): readonly string[] {
  const anyLanguage = wanted.some((id) => id.startsWith('language:'))
  if (!anyLanguage) return []
  return IMPLIED_BY_A_LANGUAGE.filter((id) => !asked.has(id) && available.has(id))
}

function add(
  available: ReadonlyMap<string, Preset>,
  id: string,
  ordered: Preset[],
  seen: Set<string>,
  where: string,
  chain: readonly string[],
): void {
  if (seen.has(id)) return
  if (chain.includes(id)) {
    throw new Error(`${where}: presets require each other in a circle: ${[...chain, id].join(' -> ')}.`)
  }
  const preset = available.get(id)
  if (preset === undefined) throw new Error(`${where}: \`${id}\` is not a preset.${nearest(available, id)}`)

  for (const required of preset.requires) {
    add(available, required, ordered, seen, where, [...chain, id])
  }
  seen.add(id)
  ordered.push(preset)
}

function nearest(available: ReadonlyMap<string, Preset>, id: string): string {
  const head = id.includes(':') ? `${id.slice(0, id.indexOf(':'))}:` : ''
  const near = [...available.keys()].filter((candidate) => candidate.startsWith(head))
  return near.length === 0 ? '' : `\n  Presets of that kind: ${near.join(', ')}`
}

function assertNoConflict(presets: readonly Preset[], where: string): void {
  const chosen = new Set(presets.map((preset) => preset.id))
  for (const preset of presets) {
    for (const conflict of preset.conflicts) {
      if (!chosen.has(conflict)) continue
      throw new Error(
        `${where}: \`${preset.id}\` and \`${conflict}\` cannot both be selected.\n` +
          `  ${preset.source} declares the conflict. Remove one of the two.`,
      )
    }
  }
}
