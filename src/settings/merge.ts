import { OPERATIONS, type Operation, type Preset, type SettingSlot } from 'types/manifest'
import { isTable, type Table } from '@/settings/toml'
import type { DeadEntry, Loosening, Merged, ResolvedSetting, SettingEntry } from 'types/settings'

export function readEntries(
  tables: ReadonlyMap<string, Table>,
  source: string,
  scope: string,
): readonly SettingEntry[] {
  const entries: SettingEntry[] = []
  for (const [head, table] of tables) walk(table, [head], entries, source, scope)
  return entries
}

function walk(
  table: Table,
  path: readonly string[],
  entries: SettingEntry[],
  source: string,
  scope: string,
): void {
  for (const [key, value] of Object.entries(table)) {
    const operation = OPERATIONS.find((candidate) => candidate === key)
    if (operation !== undefined) {
      readOperation(value, operation, path, entries, source, scope)
      continue
    }
    if (isTable(value)) walk(value, [...path, key], entries, source, scope)
  }
}

function readOperation(
  value: unknown,
  operation: Operation,
  path: readonly string[],
  entries: SettingEntry[],
  source: string,
  scope: string,
): void {
  if (!isTable(value)) {
    throw new Error(`${source}: \`${[...path, operation].join('.')}\` must name the settings it changes.`)
  }
  for (const [name, written] of Object.entries(value)) {
    entries.push({
      name: [...path, name].join('.'),
      operation,
      value: written,
      where: `${source} [${path.join('.')}] ${operation}.${name}`,
      scope,
    })
  }
}

export function slotsOf(presets: readonly Preset[]): ReadonlyMap<string, SettingSlot> {
  const slots = new Map<string, SettingSlot>()
  for (const preset of presets) {
    for (const slot of preset.settings) slots.set(slot.name, slot)
  }
  return slots
}

export function mergeSettings(
  presets: readonly Preset[],
  entries: readonly SettingEntry[],
): Merged {
  const slots = slotsOf(presets)
  const resolved = new Map<string, ResolvedSetting>()
  const dead: DeadEntry[] = []
  const loosenings: Loosening[] = []

  for (const preset of presets) {
    for (const [name, value] of preset.defaults) {
      const slot = slots.get(name)
      if (slot === undefined) continue
      resolved.set(name, { name, value, direction: slot.direction, sources: [preset.id] })
    }
  }

  const ordered = [...entries].sort((left, right) => (left.scope === '' ? 1 : 0) - (right.scope === '' ? 1 : 0))
  for (const entry of ordered) {
    const slot = slots.get(entry.name)
    if (slot === undefined) throw unknownSetting(entry, slots)
    if (!slot.ops.includes(entry.operation)) throw wrongOperation(entry, slot)
    loosenings.push(...reasonsIn(entry, slot, resolved.get(entry.name)?.value))
    apply(resolved, entry, slot, dead)
  }
  return { settings: resolved, dead, loosenings }
}

function apply(
  resolved: Map<string, ResolvedSetting>,
  entry: SettingEntry,
  slot: SettingSlot,
  dead: DeadEntry[],
): void {
  const current = resolved.get(entry.name)
  const sources = [...(current?.sources ?? []), entry.where]
  const before = current?.value
  const value = combine(before, entry, dead)
  if (value === before && entry.operation !== 'set') {
    dead.push({ entry, why: `changes nothing: the value is already what this entry asks for` })
  }
  resolved.set(entry.name, { name: entry.name, value, direction: slot.direction, sources })
}

function combine(before: unknown, entry: SettingEntry, dead: DeadEntry[]): unknown {
  if (entry.operation === 'set') return valueOf(entry.value)
  const current = Array.isArray(before) ? [...(before as unknown[])] : []
  const written = Array.isArray(entry.value) ? (entry.value as unknown[]) : [entry.value]
  if (entry.operation === 'add') return deduplicate([...current, ...written])
  const removing = written.map((value) => key(value))
  const kept = current.filter((value) => !removing.includes(key(value)))
  if (kept.length === current.length) {
    dead.push({ entry, why: 'removes a value that is not there' })
  }
  return kept
}

function valueOf(value: unknown): unknown {
  return isTable(value) && 'value' in value ? value['value'] : value
}

function deduplicate(values: readonly unknown[]): readonly unknown[] {
  const seen = new Set<string>()
  return values.filter((value) => {
    const identity = key(value)
    if (seen.has(identity)) return false
    seen.add(identity)
    return true
  })
}

function key(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function reasonsIn(entry: SettingEntry, slot: SettingSlot, current: unknown): readonly Loosening[] {
  if (slot.direction === 'ceiling') return raisedCeiling(entry, current)
  if (slot.direction !== 'loosening') return []
  const values = Array.isArray(entry.value) ? (entry.value as unknown[]) : [entry.value]
  return values.map((value) => {
    const reason = isTable(value) ? value['reason'] : undefined
    if (typeof reason !== 'string' || reason.trim().length === 0) {
      throw new Error(
        `${entry.where}: loosens \`${entry.name}\` and carries no reason.\n` +
          '  Write it as { value = "...", reason = "..." }. Every loosening entry is printed\n' +
          '  in every run report.',
      )
    }
    return { name: entry.name, reason }
  })
}

function raisedCeiling(entry: SettingEntry, current: unknown): readonly Loosening[] {
  const raw = isTable(entry.value) ? entry.value['value'] : entry.value
  if (typeof raw !== 'number' || typeof current !== 'number' || raw <= current) return []
  const reason = isTable(entry.value) ? entry.value['reason'] : undefined
  if (typeof reason !== 'string' || reason.trim().length === 0) {
    throw new Error(
      `${entry.where}: raises \`${entry.name}\` from ${current} to ${raw} and carries no reason.\n` +
        '  Write it as { value = ' + String(raw) + ', reason = "..." }. Every entry that allows more\n' +
        '  than the preset does is printed in every run report.',
    )
  }
  return [{ name: entry.name, reason }]
}

function unknownSetting(entry: SettingEntry, slots: ReadonlyMap<string, SettingSlot>): Error {
  const head = entry.name.slice(0, entry.name.lastIndexOf('.'))
  const near = [...slots.keys()].filter((name) => name.startsWith(head))
  return new Error(
    `${entry.where}: \`${entry.name}\` is not a setting any selected preset exposes.` +
      (near.length === 0 ? '' : `\n  Settings under ${head}: ${near.join(', ')}`),
  )
}

function wrongOperation(entry: SettingEntry, slot: SettingSlot): Error {
  return new Error(
    `${entry.where}: \`${entry.name}\` does not take \`${entry.operation}\`.\n` +
      `  It takes: ${slot.ops.join(', ')}.`,
  )
}
