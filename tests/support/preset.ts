import { MINIMAL_PRESET } from '@config/tests/manifests'
import { parsePreset } from '@/settings/preset'
import type { Preset, SettingSlot } from 'types/manifest'

export function manifestWith(from: string, to: string): string {
  if (!MINIMAL_PRESET.includes(from)) throw new Error(`the manifest has no \`${from}\` to replace`)
  return MINIMAL_PRESET.replace(from, to)
}

export function presetWith(slots: SettingSlot[] = [], defaults: [string, unknown][] = []): Preset {
  const base = parsePreset(MINIMAL_PRESET, 'test.toml')
  return { ...base, settings: slots, defaults: new Map(defaults) }
}

export function presetFrom(manifest: string, source = 'test.toml'): Preset {
  return parsePreset(manifest, source)
}

export function available(...presets: Preset[]): ReadonlyMap<string, Preset> {
  return new Map(presets.map((preset) => [preset.id, preset]))
}
