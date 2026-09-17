import { FAILS_ON, FILE_LIST_MECHANISMS, FIX_STAGES, INSPECTIONS, MECHANISMS, REQUIREMENTS, STAGES, TAKES, type Check, type FileListPlan, type ToolError } from 'types/manifest'
import { choiceList, optionalChoice, optionalString, optionalTable, requiredChoice, requiredString, requiredTable, stringList, tableList, type Table } from '@/settings/toml'
import { compileSelector } from '@/settings/selector'
import { BUILTIN_NAMES } from '@/structure/builtin'
import { COUNT_MEASURES } from '@config/structure'
import type { LimitPlan } from 'types/structure'
import { optional } from '@/settings/optional'

export function readCheck(entry: Table, source: string): Check {
  const id = requiredString(entry, 'id', `${source} [[checks]]`)
  const where = `${source} [[checks]] ${id}`

  const inspects = choiceList(entry, 'inspects', INSPECTIONS, where)
  if (inspects.length === 0) {
    throw new Error(
      `${where}: declares no inspection.\n` +
        '  Coverage is measured per inspection, so a check that inspects nothing can claim nothing.',
    )
  }

  const mechanism = requiredChoice(entry, 'mechanism', MECHANISMS, where)
  const searched = stringList(entry, 'searched', where)
  const justification = optionalString(entry, 'verdict', where)
  if ((mechanism === 'plugin' || mechanism === 'original') && (searched.length === 0 || !justification)) {
    throw new Error(
      `${where}: mechanism \`${mechanism}\` writes code, so it owes \`searched\` and \`verdict\`.\n` +
        '  Name the tools searched and why none of them expresses the rule.\n' +
        '  Both are reviewed at every release; that is what stops a fifth quality folder growing.',
    )
  }

  const command = stringList(entry, 'command', where)
  const rules = optionalString(entry, 'rules', where)
  const builtin = optionalString(entry, 'builtin', where)
  const declared = [command.length > 0 && 'command', rules !== undefined && 'rules', builtin !== undefined && 'builtin'].filter(
    (name): name is string => name !== false,
  )
  if (declared.length === 0) {
    throw new Error(
      `${where}: declares none of \`command\`, \`rules\` or \`builtin\`.\n` +
        '  A check runs a tool, a preset-local directory of ast-grep rule files, or one of\n' +
        `  gspot's own analyses: ${BUILTIN_NAMES.join(', ')}.`,
    )
  }
  if (declared.length > 1) {
    throw new Error(
      `${where}: declares ${declared.join(' and ')}.\n` +
        '  One check is one implementation. Two would disagree, and the id would name whichever ran.',
    )
  }
  if (rules !== undefined) assertPresetLocal(rules, 'rules', where)
  if (builtin !== undefined && !BUILTIN_NAMES.includes(builtin)) {
    throw new Error(
      `${where}: \`${builtin}\` is not one of gspot's own analyses.\n` +
        `  They are: ${BUILTIN_NAMES.join(', ')}.`,
    )
  }
  const inProcess = rules !== undefined || builtin !== undefined
  const limit = readLimit(entry, where, inProcess, rules !== undefined)
  const paths = stringList(entry, 'paths', where)

  const failsOn = requiredChoice(entry, 'fails_on', FAILS_ON, where)
  const countRegex = optionalString(entry, 'count_regex', where)
  if (failsOn !== 'exit-code' && countRegex === undefined && !inProcess) {
    throw new Error(
      `${where}: \`fails_on = "${failsOn}"\` needs \`count_regex\`.\n` +
        '  A check whose exit code ignores its findings says how to count them instead.\n' +
        '  A check gspot runs itself is exempt: it holds its findings and counts them, rather\n' +
        '  than reading a number back out of text it just printed.',
    )
  }

  const stage = requiredChoice(entry, 'stage', STAGES, where)
  const requires = choiceList(entry, 'requires', REQUIREMENTS, where)
  if (stage === 'pre-commit' && requires.length > 0) {
    throw new Error(
      `${where}: runs at pre-commit and requires ${requires.join(', ')}.\n` +
        '  Stage follows from what a check needs, never from habit. A check that needs a build,\n' +
        '  a daemon or the network runs at pre-push, where the requirement is met.',
    )
  }

  return {
    id,
    inspects,
    mechanism,
    stage,
    takes: requiredChoice(entry, 'takes', TAKES, where),
    ...(command.length === 0 ? {} : { command }),
    ...optional('rules', rules),
    ...optional('builtin', builtin),
    ...(paths.length === 0 ? {} : { paths: compileSelector(paths, `${where} paths`) }),
    ...(limit === undefined ? {} : { limit }),
    failsOn,
    ...(countRegex === undefined ? {} : { countRegex }),
    fileList: readFileList(entry, where, inProcess),
    requires,
    invocationModes: choiceList(entry, 'invocation_modes', TAKES, where),
    toolErrors: readToolErrors(entry, where),
    ...optional('fix', optionalList(entry, 'fix', where)),
    ...optional('fixStage', optionalChoice(entry, 'fix_stage', FIX_STAGES, where)),
    ...optional('skipWhen', optionalString(entry, 'skip_when', where)),
    tools: stringList(entry, 'tools', where),
    ...optional('configArg', optionalString(entry, 'config_arg', where)),
    ...(searched.length === 0 ? {} : { searched }),
    ...optional('justification', justification),
  }
}

function readLimit(
  entry: Table,
  where: string,
  inProcess: boolean,
  counting: boolean,
): LimitPlan | undefined {
  const table = optionalTable(entry, 'limit', where)
  if (table === undefined) return undefined
  if (!inProcess) {
    throw new Error(
      `${where}: declares \`limit\` and runs a tool.\n` +
        '  A tool reports its own findings against its own configuration. Point it at the\n' +
        '  generated file with `config_arg`, and put the number in the template.',
    )
  }
  const setting = requiredString(table, 'setting', `${where} limit`)
  if (!counting) return { setting }
  return {
    setting,
    measure: requiredChoice(table, 'measure', COUNT_MEASURES, `${where} limit`),
  }
}

function readFileList(entry: Table, where: string, inProcess: boolean): FileListPlan {
  const table = requiredTable(entry, 'file_list', where)
  const via = requiredChoice(table, 'via', FILE_LIST_MECHANISMS, `${where} file_list`)
  const command = stringList(table, 'command', `${where} file_list`)
  if (inProcess && via !== 'file-list') {
    throw new Error(
      `${where}: a check gspot runs itself reports the paths it read, so its listing is \`file-list\`.\n` +
        `  \`file_list.via = "${via}"\` asks somebody else about a check gspot runs itself.`,
    )
  }
  if (!inProcess && via !== 'declared' && via !== 'ignore-replay' && command.length === 0) {
    throw new Error(
      `${where}: \`file_list.via = "${via}"\` asks a tool, so it needs \`file_list.command\`.\n` +
        '  Only `declared` asserts without asking, and every declared row is reported as unverified.',
    )
  }
  const ignoreFiles = stringList(table, 'ignore_files', `${where} file_list`)
  if (via === 'ignore-replay' && ignoreFiles.length === 0) {
    throw new Error(
      `${where}: an \`ignore-replay\` listing needs \`file_list.ignore_files\`.\n` +
        '  Name the files the tool honours, so the replay reads the same ones it does.',
    )
  }
  const pathRegex = optionalString(table, 'path_regex', `${where} file_list`)
  const ignoredRegex = optionalString(table, 'ignored_regex', `${where} file_list`)
  for (const pattern of [pathRegex, ignoredRegex]) {
    if (pattern !== undefined) assertCompiles(pattern, `${where} file_list`)
  }
  return {
    via,
    ...(command.length === 0 ? {} : { command }),
    ...(pathRegex === undefined ? {} : { pathRegex }),
    ...(ignoredRegex === undefined ? {} : { ignoredRegex }),
    ...(ignoreFiles.length === 0 ? {} : { ignoreFiles }),
  }
}

function readToolErrors(entry: Table, where: string): readonly ToolError[] {
  return tableList(entry, 'tool_errors', where).map((table, position) => {
    const at = `${where} [[checks.tool_errors]] ${position}`
    const regex = requiredString(table, 'regex', at)
    assertCompiles(regex, at)
    return { regex, message: requiredString(table, 'message', at) }
  })
}

function assertCompiles(pattern: string, where: string): void {
  try {
    new RegExp(pattern)
  } catch (reason) {
    throw new Error(`${where}: \`${pattern}\` is not a usable pattern.\n  ${(reason as Error).message}`)
  }
}

function optionalList(entry: Table, key: string, where: string): readonly string[] | undefined {
  const value = stringList(entry, key, where)
  return value.length === 0 ? undefined : value
}

export function assertPresetLocal(path: string, what: string, where: string): void {
  if (path.startsWith('/') || path.includes('..')) {
    throw new Error(
      `${where}: ${what} \`${path}\` reaches outside the preset.\n` +
        '  A check that needs a product fact reads the product file itself, and names it.',
    )
  }
}
