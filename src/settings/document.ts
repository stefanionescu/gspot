import { readFile } from 'node:fs/promises'
import { SETTINGS_ROOT_KEYS } from '@config/presets'
import { SETTINGS_SCHEMA_VERSION } from '@config/versions'
import { readDeclarations, readExceptions } from '@/settings/declaration'
import { compileSelector } from '@/settings/selector'
import {
  choiceList,
  optionalBoolean,
  optionalChoice,
  optionalNumber,
  optionalString,
  optionalTable,
  readDocument,
  requiredChoice,
  requiredString,
  stringList,
  tableList,
  type Table,
} from '@/settings/toml'
import { FAILS_ON, INSPECTIONS, REQUIREMENTS, STAGES, TAKES } from 'types/manifest'
import { CI_PROVIDERS, RUNNERS } from 'types/settings'
import { optional } from '@/settings/optional'
import type {
  ConsumerCheck,
  Gate,
  LocalSettings,
  Scope,
  SettingsDocument,
} from 'types/settings'

export async function readSettings(path: string): Promise<SettingsDocument> {
  try {
    return parseSettings(await readFile(path, 'utf8'), path)
  } catch (reason) {
    if ((reason as NodeJS.ErrnoException).code !== 'ENOENT') throw reason
    throw new Error(
      `${path} does not exist, so this repository has no policy yet.\n` +
        '  Run `gspot init` to read the repository and propose one.',
    )
  }
}

export function parseSettings(text: string, source: string): SettingsDocument {
  const document = readDocument(text, source)
  const version = optionalNumber(document, 'version', source)
  if (version !== SETTINGS_SCHEMA_VERSION) {
    throw new Error(
      `${source}: \`version\` is ${version ?? 'absent'}, and this gspot reads version ` +
        `${SETTINGS_SCHEMA_VERSION}.\n` +
        '  There is no automatic migration: an automatic migration is how a loosening entry\n' +
        '  survives a rename without anybody reading it again.',
    )
  }
  return {
    version,
    runner: requiredChoice(document, 'runner', RUNNERS, source),
    gate: readGate(document, source),
    presets: stringList(document, 'presets', source),
    scopes: readScopes(document, source),
    declarations: readDeclarations(document, source),
    exceptions: readExceptions(document, source),
    checks: readConsumerChecks(document, source),
    tables: readPresetTables(document, source),
    source,
  }
}

function readGate(document: Table, source: string): Gate {
  const table = optionalTable(document, 'gate', source) ?? {}
  return {
    hooks: optionalBoolean(table, 'hooks', `${source} [gate]`) ?? false,
    ci: optionalChoice(table, 'ci', CI_PROVIDERS, `${source} [gate]`) ?? 'none',
  }
}

function readScopes(document: Table, source: string): readonly Scope[] {
  const scopes = tableList(document, 'scope', source).map((entry, position) => {
    const where = `${source} [[scope]] ${position}`
    const path = requiredString(entry, 'path', where)
    if (path.startsWith('/') || path.endsWith('/') || path.includes('..')) {
      throw new Error(`${where}: \`${path}\` is not a repository-relative directory.`)
    }
    return { path, presets: stringList(entry, 'presets', `${where} (${path})`) }
  })
  assertFlat(scopes, source)
  return scopes
}

function assertFlat(scopes: readonly Scope[], source: string): void {
  for (const outer of scopes) {
    for (const inner of scopes) {
      if (inner === outer || !inner.path.startsWith(`${outer.path}/`)) continue
      throw new Error(
        `${source}: scope \`${inner.path}\` sits inside scope \`${outer.path}\`.\n` +
          '  Scopes are flat. Root presets already apply to the whole tree.',
      )
    }
  }
}

function readConsumerChecks(document: Table, source: string): readonly ConsumerCheck[] {
  return tableList(document, 'check', source).map((entry) => {
    const id = requiredString(entry, 'id', `${source} [[check]]`)
    const where = `${source} [[check]] ${id}`
    const paths = stringList(entry, 'paths', where)
    if (paths.length === 0) throw new Error(`${where}: names no paths, so it claims nothing.`)
    const command = stringList(entry, 'command', where)
    if (command.length === 0) throw new Error(`${where}: names no command to run.`)
    return {
      paths: compileSelector(paths, `${where} paths`),
      check: {
        id,
        inspects: choiceList(entry, 'inspects', INSPECTIONS, where),
        mechanism: 'original',
        stage: requiredChoice(entry, 'stage', STAGES, where),
        takes: optionalChoice(entry, 'takes', TAKES, where) ?? 'file-list',
        command,
        failsOn: requiredChoice(entry, 'fails_on', FAILS_ON, where),
        ...countRegexOf(entry, where),
        fileList: { via: 'declared' },
        requires: choiceList(entry, 'requires', REQUIREMENTS, where),
        invocationModes: [],
        toolErrors: [],
        ...presentList('fix', stringList(entry, 'fix', where)),
        tools: [],
      },
    }
  })
}

function countRegexOf(entry: Table, where: string): { countRegex?: string } {
  const failsOn = requiredChoice(entry, 'fails_on', FAILS_ON, where)
  const countRegex = optionalString(entry, 'count_regex', where)
  if (failsOn !== 'exit-code' && countRegex === undefined) {
    throw new Error(`${where}: \`fails_on = "${failsOn}"\` needs \`count_regex\`.`)
  }
  return countRegex === undefined ? {} : { countRegex }
}

function readPresetTables(document: Table, source: string): ReadonlyMap<string, Table> {
  const tables = new Map<string, Table>()
  for (const key of Object.keys(document)) {
    if (SETTINGS_ROOT_KEYS.includes(key)) continue
    const table = optionalTable(document, key, source)
    if (table === undefined) {
      throw new Error(`${source}: \`${key}\` is not a setting gspot knows, and it is not a table.`)
    }
    tables.set(key, table)
  }
  return tables
}

export function parseLocalSettings(text: string, source: string): LocalSettings {
  const document = readDocument(text, source)
  for (const key of Object.keys(document)) {
    if (key === 'skip') continue
    throw new Error(
      `${source}: \`${key}\` belongs in gspot.toml, not here.\n` +
        '  This file carries machine-local skips and nothing else, so that a local decision\n' +
        '  never becomes the team default without anybody reviewing it.',
    )
  }
  return { skip: stringList(document, 'skip', source) }
}

export async function readLocalSettings(path: string): Promise<LocalSettings> {
  try {
    return parseLocalSettings(await readFile(path, 'utf8'), path)
  } catch (reason) {
    if ((reason as NodeJS.ErrnoException).code === 'ENOENT') return { skip: [] }
    throw reason
  }
}

function presentList<Key extends string>(
  key: Key,
  values: readonly string[],
): Partial<Record<Key, readonly string[]>> {
  return optional(key, values.length === 0 ? undefined : values)
}
