import { parseSettings } from '@/settings/document'
import { readEntries } from '@/settings/merge'
import type { SettingSlot } from 'types/manifest'
import type { SettingEntry } from 'types/settings'

export const SLOTS: SettingSlot[] = [
  { name: 'limits.file_lines', ops: ['set'], direction: 'declared-per-rule' },
  { name: 'naming.banned_terms', ops: ['add', 'remove'], direction: 'tightening' },
  { name: 'spelling.typos.words', ops: ['add'], direction: 'loosening' },
]

export function entriesFrom(toml: string, scope = ''): readonly SettingEntry[] {
  const document = parseSettings(`version = 1\nrunner = "mise"\n${toml}`, 'gspot.toml')
  return readEntries(document.tables, 'gspot.toml', scope)
}
