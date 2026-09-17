import { parse } from 'smol-toml'

export type Table = Readonly<Record<string, unknown>>

export function readDocument(text: string, where: string): Table {
  try {
    return parse(text) as Table
  } catch (reason) {
    throw new Error(`${where} is not valid TOML.\n  ${(reason as Error).message}`)
  }
}

export function requiredString(table: Table, key: string, where: string): string {
  const value = table[key]
  if (typeof value !== 'string') throw wrong(where, key, 'a string', value)
  return value
}

export function optionalString(table: Table, key: string, where: string): string | undefined {
  const value = table[key]
  if (value === undefined) return undefined
  if (typeof value !== 'string') throw wrong(where, key, 'a string', value)
  return value
}

export function optionalBoolean(table: Table, key: string, where: string): boolean | undefined {
  const value = table[key]
  if (value === undefined) return undefined
  if (typeof value !== 'boolean') throw wrong(where, key, 'true or false', value)
  return value
}

export function optionalNumber(table: Table, key: string, where: string): number | undefined {
  const value = table[key]
  if (value === undefined) return undefined
  if (typeof value !== 'number') throw wrong(where, key, 'a number', value)
  return value
}

export function stringList(table: Table, key: string, where: string): readonly string[] {
  const value = table[key]
  if (value === undefined) return []
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw wrong(where, key, 'a list of strings', value)
  }
  return value as readonly string[]
}

export function requiredTable(table: Table, key: string, where: string): Table {
  const value = table[key]
  if (!isTable(value)) throw wrong(where, key, 'a table', value)
  return value
}

export function optionalTable(table: Table, key: string, where: string): Table | undefined {
  const value = table[key]
  if (value === undefined) return undefined
  if (!isTable(value)) throw wrong(where, key, 'a table', value)
  return value
}

export function tableList(table: Table, key: string, where: string): readonly Table[] {
  const value = table[key]
  if (value === undefined) return []
  if (!Array.isArray(value) || !value.every(isTable)) {
    throw wrong(where, key, `one or more [[${key}]] tables`, value)
  }
  return value as readonly Table[]
}

export function requiredChoice<Choice extends string>(
  table: Table,
  key: string,
  allowed: readonly Choice[],
  where: string,
): Choice {
  const value = requiredString(table, key, where)
  if (!allowed.includes(value as Choice)) {
    throw new Error(
      `${where}: \`${key}\` is \`${value}\`, which is not one of: ${allowed.join(', ')}.`,
    )
  }
  return value as Choice
}

export function optionalChoice<Choice extends string>(
  table: Table,
  key: string,
  allowed: readonly Choice[],
  where: string,
): Choice | undefined {
  return table[key] === undefined ? undefined : requiredChoice(table, key, allowed, where)
}

export function choiceList<Choice extends string>(
  table: Table,
  key: string,
  allowed: readonly Choice[],
  where: string,
): readonly Choice[] {
  const values = stringList(table, key, where)
  for (const value of values) {
    if (!allowed.includes(value as Choice)) {
      throw new Error(
        `${where}: \`${key}\` contains \`${value}\`, which is not one of: ${allowed.join(', ')}.`,
      )
    }
  }
  return values as readonly Choice[]
}

export function isTable(value: unknown): value is Table {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function wrong(where: string, key: string, wanted: string, got: unknown): Error {
  return new Error(`${where}: \`${key}\` must be ${wanted}, and it is ${shape(got)}.`)
}

function shape(value: unknown): string {
  if (value === undefined) return 'absent'
  if (Array.isArray(value)) return 'a list'
  if (value === null) return 'empty'
  return typeof value
}
