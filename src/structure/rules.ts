import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { RULE_FILE_SUFFIX } from '@config/structure'
import type { StructureRule } from 'types/structure'

export function parseRule(text: string, source: string): StructureRule {
  const document = readDocument(text, source)
  return {
    id: required(document, 'id', source),
    language: required(document, 'language', source),
    message: required(document, 'message', source),
    rule: table(document, 'rule', source),
    ...optionalYamlTable(document, 'constraints', source),
    ...optionalYamlTable(document, 'utils', source),
    source,
  }
}

export async function readRules(directory: string): Promise<readonly StructureRule[]> {
  const names = (await readdir(directory)).filter((name) => name.endsWith(RULE_FILE_SUFFIX)).sort()
  const rules: StructureRule[] = []
  for (const name of names) {
    const path = join(directory, name)
    rules.push(parseRule(await readFile(path, 'utf8'), path))
  }
  return rules
}

type Document = Record<string, unknown>

function readDocument(text: string, source: string): Document {
  let document: unknown
  try {
    document = parseYaml(text)
  } catch (reason) {
    throw new Error(`${source} is not valid YAML.\n  ${(reason as Error).message}`)
  }
  if (typeof document !== 'object' || document === null || Array.isArray(document)) {
    throw new Error(`${source}: a rule file holds one document, and this holds something else.`)
  }
  return document as Document
}

function required(document: Document, key: string, source: string): string {
  const value = document[key]
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${source}: \`${key}\` is required, and it is a string naming the rule.`)
  }
  return value
}

function table(document: Document, key: string, source: string): Record<string, unknown> {
  const value = document[key]
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(
      `${source}: \`${key}\` is required, and it is an ast-grep rule object.\n` +
        '  See https://ast-grep.github.io/reference/rule.html',
    )
  }
  return value as Record<string, unknown>
}

function optionalYamlTable(
  document: Document,
  key: 'constraints' | 'utils',
  source: string,
): Partial<Record<'constraints' | 'utils', Record<string, unknown>>> {
  return document[key] === undefined ? {} : { [key]: table(document, key, source) }
}
