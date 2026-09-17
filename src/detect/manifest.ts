import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parse } from 'smol-toml'
import { MANIFEST_NAMES, NPM_DEPENDENCY_FIELDS } from '@config/detection'
import type { Manifest, ManifestName } from 'types/detect'

export function manifestPaths(tracked: readonly string[]): readonly string[] {
  return tracked.filter((path) => {
    const name = path.slice(path.lastIndexOf('/') + 1)
    return (MANIFEST_NAMES as readonly string[]).includes(name)
  })
}

export async function readManifests(
  root: string,
  tracked: readonly string[],
): Promise<readonly Manifest[]> {
  const manifests: Manifest[] = []
  for (const path of manifestPaths(tracked)) {
    const manifest = await readManifest(root, path)
    if (manifest !== null) manifests.push(manifest)
  }
  return manifests
}

async function readManifest(root: string, path: string): Promise<Manifest | null> {
  const name = path.slice(path.lastIndexOf('/') + 1) as ManifestName
  const cut = path.lastIndexOf('/')
  const directory = cut === -1 ? '' : path.slice(0, cut)
  let text: string
  try {
    text = await readFile(join(root, path), 'utf8')
  } catch {
    return null
  }
  const read = readerFor(name)(text)
  return { path, name, directory, dependencies: read.dependencies, tables: read.tables }
}

type Read = { dependencies: readonly string[]; tables: readonly string[] }
type Reader = (text: string) => Read

function readerFor(name: ManifestName): Reader {
  switch (name) {
    case 'package.json':
      return readPackageJson
    case 'pyproject.toml':
      return readPyproject
    case 'requirements.txt':
      return readRequirements
    case 'Package.swift':
      return readPackageSwift
    case 'go.mod':
      return readGoMod
    case 'Cargo.toml':
      return readCargo
    case 'Gemfile':
      return readGemfile
  }
}

function readPackageJson(text: string): Read {
  const document = parseJson(text)
  if (document === null) return empty()
  const dependencies = NPM_DEPENDENCY_FIELDS.flatMap((field) => Object.keys(asTable(document[field])))
  return { dependencies, tables: Object.keys(document) }
}

function readPyproject(text: string): Read {
  const document = parseToml(text)
  if (document === null) return empty()
  const project = asTable(document['project'])
  const declared = [...asList(project['dependencies']), ...optionalGroups(project)]
  const poetry = asTable(asTable(document['tool'])['poetry'])
  return {
    dependencies: [...declared, ...Object.keys(asTable(poetry['dependencies']))].map(packageNameOf),
    tables: tableNames(document),
  }
}

function optionalGroups(project: Record<string, unknown>): readonly string[] {
  return Object.values(asTable(project['optional-dependencies'])).flatMap(asList)
}

function readRequirements(text: string): Read {
  const dependencies = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#') && !line.startsWith('-'))
    .map(packageNameOf)
  return { dependencies, tables: [] }
}

function readPackageSwift(text: string): Read {
  const dependencies = [...text.matchAll(/url:\s*"[^"]*\/([\w.-]+?)(?:\.git)?"/gu)].map(
    (found) => found[1] ?? '',
  )
  return { dependencies: dependencies.filter((name) => name.length > 0), tables: [] }
}

function readGoMod(text: string): Read {
  const dependencies = [...text.matchAll(/^\s*([\w.\-/]+)\s+v\d\S*/gmu)].map((found) => found[1] ?? '')
  return { dependencies: dependencies.filter((name) => name.length > 0), tables: [] }
}

function readCargo(text: string): Read {
  const document = parseToml(text)
  if (document === null) return empty()
  const dependencies = ['dependencies', 'dev-dependencies', 'build-dependencies'].flatMap((field) =>
    Object.keys(asTable(document[field])),
  )
  return { dependencies, tables: tableNames(document) }
}

function readGemfile(text: string): Read {
  const dependencies = [...text.matchAll(/^\s*gem\s+["']([\w.-]+)["']/gmu)].map((found) => found[1] ?? '')
  return { dependencies: dependencies.filter((name) => name.length > 0), tables: [] }
}

function packageNameOf(specifier: string): string {
  return (specifier.split(/[[<>=!~;\s]/u)[0] ?? '').trim().toLowerCase()
}

function tableNames(document: Record<string, unknown>): readonly string[] {
  const names: string[] = []
  for (const [key, value] of Object.entries(document)) {
    names.push(key)
    if (typeof value !== 'object' || value === null || Array.isArray(value)) continue
    for (const inner of Object.keys(value as Record<string, unknown>)) names.push(`${key}.${inner}`)
  }
  return names
}

function parseJson(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return null
  }
}

function parseToml(text: string): Record<string, unknown> | null {
  try {
    return parse(text) as Record<string, unknown>
  } catch {
    return null
  }
}

function asTable(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asList(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

function empty(): Read {
  return { dependencies: [], tables: [] }
}
