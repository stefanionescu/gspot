import { readFile } from 'node:fs/promises'
import { assertPresetLocal, readCheck } from '@/settings/check'
import { DIRECTIONS, INSPECTIONS, OPERATIONS, PRESET_KINDS, PROVIDERS, type Check, type Claims, type ConfigArtifact, type Inspection, type Preset, type PresetKind, type SettingSlot, type TaskNode, type ToolRequirement } from 'types/manifest'
import { GENERATED_DIRECTORY } from '@config/paths'
import { choiceList, optionalString, optionalTable, readDocument, requiredChoice, requiredString, stringList, tableList, type Table } from '@/settings/toml'
import { optional } from '@/settings/optional'

export async function readPreset(path: string): Promise<Preset> {
  return parsePreset(await readFile(path, 'utf8'), path)
}

export function parsePreset(text: string, source: string): Preset {
  const document = readDocument(text, source)
  const header = optionalTable(document, 'preset', source)
  if (header === undefined) throw new Error(`${source}: has no [preset] table.`)

  const kind = requiredChoice(header, 'kind', PRESET_KINDS, `${source} [preset]`)
  const id = readIdentifier(header, kind, source)
  const claims = readClaims(document, source)
  const required = readRequired(document, source)
  const checks = tableList(document, 'checks', source).map((entry) => readCheck(entry, source))
  const configs = readConfigs(document, source)
  const tasks = readTasks(document, source)
  const settings = readSettings(document, source)
  const defaults = readDefaults(document, source)

  const supplies = header['supplies'] === true
  if (!supplies) assertEveryClaimIsRequired(claims, required, source)
  if (supplies && required.size > 0) {
    throw new Error(
      `${source}: declares \`supplies = true\` and a [required] table.\n` +
        '  A supplier adds an inspection over files another preset owns. Requiring an inspection\n' +
        '  of an extension is what owning it means, and two presets cannot both own one.',
    )
  }
  assertEveryConfigHasAReader(configs, checks, source)
  assertEveryCheckHasATask(checks, tasks, source)
  assertEveryDefaultIsASetting(defaults, settings, source)
  assertEveryLimitHasASetting(checks, settings, source)

  return {
    id,
    kind,
    supplies,
    title: requiredString(header, 'title', `${source} [preset]`),
    requires: stringList(header, 'requires', `${source} [preset]`),
    conflicts: stringList(header, 'conflicts', `${source} [preset]`),
    shared: stringList(header, 'shared', `${source} [preset]`),
    claims,
    required,
    tools: readTools(document, source),
    configs,
    checks,
    settings,
    defaults,
    tasks,
    rules: readRules(document, source),
    source,
  }
}

function readIdentifier(header: Table, kind: PresetKind, source: string): string {
  const id = requiredString(header, 'id', `${source} [preset]`)
  if (!id.startsWith(`${kind}:`) || id.length === kind.length + 1) {
    throw new Error(
      `${source} [preset]: id \`${id}\` does not name its kind.\n` +
        `  A preset of kind \`${kind}\` has an id of the shape \`${kind}:<name>\`.`,
    )
  }
  return id
}

function readClaims(document: Table, source: string): Claims {
  const table = optionalTable(document, 'claims', source) ?? {}
  const where = `${source} [claims]`
  const extensions = stringList(table, 'extensions', where)
  for (const extension of extensions) {
    if (!extension.startsWith('.')) {
      throw new Error(`${where}: \`${extension}\` is not an extension. Write it with a dot.`)
    }
  }
  return {
    extensions,
    filenames: stringList(table, 'filenames', where),
    interpreters: stringList(table, 'interpreters', where),
  }
}

function readRequired(document: Table, source: string): ReadonlyMap<string, readonly Inspection[]> {
  const table = optionalTable(document, 'required', source) ?? {}
  const where = `${source} [required]`
  const required = new Map<string, readonly Inspection[]>()
  for (const key of Object.keys(table)) {
    const inspections = choiceList(table, key, INSPECTIONS, where)
    if (inspections.length === 0) {
      throw new Error(`${where}: \`${key}\` requires nothing, so nothing about it can fail.`)
    }
    required.set(key, inspections)
  }
  return required
}

function readTools(document: Table, source: string): readonly ToolRequirement[] {
  return tableList(document, 'tools', source).map((entry) => {
    const where = `${source} [[tools]]`
    const id = requiredString(entry, 'id', where)
    return {
      id,
      version: requiredString(entry, 'version', `${where} ${id}`),
      provider: requiredChoice(entry, 'provider', PROVIDERS, `${where} ${id}`),
      ...optional('package', optionalString(entry, 'package', `${where} ${id}`)),
      ...optional('url', optionalString(entry, 'url', `${where} ${id}`)),
    }
  })
}

function readConfigs(document: Table, source: string): readonly ConfigArtifact[] {
  return tableList(document, 'configs', source).map((entry) => {
    const where = `${source} [[configs]]`
    const target = requiredString(entry, 'target', where)
    const template = requiredString(entry, 'template', `${where} ${target}`)
    assertPresetLocal(template, 'template', `${where} ${target}`)
    if (!target.startsWith(`${GENERATED_DIRECTORY}/`)) {
      throw new Error(
        `${where} ${target}: a rendered file lands under \`${GENERATED_DIRECTORY}/\`.\n` +
          '  gspot owns what it writes and writes nowhere else, so a hand-edited file is never\n' +
          '  mistaken for a generated one. The stub at the conventional path is the opt-in.',
      )
    }
    return {
      target,
      template,
      readers: stringList(entry, 'readers', `${where} ${target}`),
      ...optional('stub', optionalString(entry, 'stub', `${where} ${target}`)),
      ...optional('stubKind', optionalString(entry, 'stub_kind', `${where} ${target}`)),
    }
  })
}

function readSettings(document: Table, source: string): readonly SettingSlot[] {
  return tableList(document, 'settings', source).map((entry) => {
    const where = `${source} [[settings]]`
    const name = requiredString(entry, 'name', where)
    const ops = choiceList(entry, 'ops', OPERATIONS, `${where} ${name}`)
    if (ops.length === 0) throw new Error(`${where} ${name}: declares no operation.`)
    return { name, ops, direction: requiredChoice(entry, 'direction', DIRECTIONS, `${where} ${name}`) }
  })
}

function readDefaults(document: Table, source: string): ReadonlyMap<string, unknown> {
  const table = optionalTable(document, 'defaults', source) ?? {}
  return new Map(Object.entries(table))
}

function readTasks(document: Table, source: string): readonly TaskNode[] {
  return tableList(document, 'tasks', source).map((entry) => {
    const where = `${source} [[tasks]]`
    const name = requiredString(entry, 'name', where)
    return {
      name,
      description: optionalString(entry, 'description', `${where} ${name}`) ?? name,
      checks: stringList(entry, 'checks', `${where} ${name}`),
      scope: requiredChoice(entry, 'scope', ['per-scope', 'repo'] as const, `${where} ${name}`),
      deps: stringList(entry, 'deps', `${where} ${name}`),
    }
  })
}

function readRules(document: Table, source: string): ReadonlyMap<string, readonly string[]> {
  const table = optionalTable(document, 'rules', source) ?? {}
  const rules = new Map<string, readonly string[]>()
  for (const layer of Object.keys(table)) {
    rules.set(layer, stringList(table, layer, `${source} [rules]`))
  }
  return rules
}

function assertEveryClaimIsRequired(
  claims: Claims,
  required: ReadonlyMap<string, readonly Inspection[]>,
  source: string,
): void {
  for (const extension of claims.extensions) {
    if (required.has(extension)) continue
    throw new Error(
      `${source}: claims \`${extension}\` and requires nothing of it.\n` +
        '  An extension with no required inspections is an extension nothing can fail on.',
    )
  }
}

function assertEveryConfigHasAReader(
  configs: readonly ConfigArtifact[],
  checks: readonly Check[],
  source: string,
): void {
  const ids = new Set(checks.map((check) => check.id))
  for (const config of configs) {
    if (config.readers.length === 0) {
      throw new Error(`${source}: \`${config.target}\` names no reader, so nothing opens it.`)
    }
    for (const reader of config.readers) {
      if (ids.has(reader)) continue
      throw new Error(
        `${source}: \`${config.target}\` names the reader \`${reader}\`, which is not a check here.`,
      )
    }
  }
}

function assertEveryCheckHasATask(
  checks: readonly Check[],
  tasks: readonly TaskNode[],
  source: string,
): void {
  for (const task of tasks) {
    for (const id of task.checks) {
      if (checks.some((check) => check.id === id)) continue
      throw new Error(`${source}: task \`${task.name}\` names \`${id}\`, which is not a check here.`)
    }
  }
  const scheduled = new Set(tasks.flatMap((task) => task.checks))
  for (const check of checks) {
    if (scheduled.has(check.id)) continue
    throw new Error(
      `${source}: check \`${check.id}\` is in no task, so nothing ever runs it.\n` +
        '  Add it to a [[tasks]] entry in the same commit, or do not add the check.',
    )
  }
}

function assertEveryDefaultIsASetting(
  defaults: ReadonlyMap<string, unknown>,
  settings: readonly SettingSlot[],
  source: string,
): void {
  const declared = new Set(settings.map((slot) => slot.name))
  for (const name of defaults.keys()) {
    if (declared.has(name)) continue
    throw new Error(
      `${source}: \`${name}\` has a default and no [[settings]] entry, so the merge drops it.\n` +
        '  Declare it under [[settings]], or move the value into the template that reads it.',
    )
  }
}

function assertEveryLimitHasASetting(
  checks: readonly Check[],
  settings: readonly SettingSlot[],
  source: string,
): void {
  const declared = new Set(settings.map((slot) => slot.name))
  for (const check of checks) {
    if (check.limit === undefined || declared.has(check.limit.setting)) continue
    throw new Error(
      `${source}: check \`${check.id}\` measures against \`${check.limit.setting}\`, which this ` +
        'preset does not declare.\n  Add it under [[settings]] with a default, or take the ' +
        '[checks.limit] table out.',
    )
  }
}
