import { delimiter, join } from 'node:path'
import { access } from 'node:fs/promises'
import { constants } from 'node:fs'
import type { Preset, ToolRequirement } from 'types/manifest'
import type { ToolProblem } from 'types/run'
import { BIN_DIRECTORY } from '@config/paths'
import type { ToolPresence } from 'types/toolchain'

export function toolsOf(presets: readonly Preset[]): ReadonlyMap<string, ToolRequirement> {
  const tools = new Map<string, ToolRequirement>()
  for (const preset of presets) {
    for (const tool of preset.tools) tools.set(tool.id, tool)
  }
  return tools
}

export function gatesOf(presets: readonly Preset[], id: string): readonly string[] {
  return presets.flatMap((preset) =>
    preset.checks.filter((check) => check.tools.includes(id)).map((check) => check.id),
  )
}

export async function readPresence(
  root: string,
  presets: readonly Preset[],
): Promise<readonly ToolPresence[]> {
  const found: ToolPresence[] = []
  for (const tool of toolsOf(presets).values()) {
    const at = await locate(root, tool.id)
    found.push({ tool, present: at !== null, at, gates: gatesOf(presets, tool.id) })
  }
  return found
}

async function locate(root: string, id: string): Promise<string | null> {
  const owned = join(root, BIN_DIRECTORY, id)
  if (await executable(owned)) return owned
  for (const directory of (process.env['PATH'] ?? '').split(delimiter)) {
    if (directory.length === 0) continue
    const candidate = join(directory, id)
    if (await executable(candidate)) return candidate
  }
  return null
}

async function executable(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

export function problemsOf(presence: readonly ToolPresence[]): readonly ToolProblem[] {
  return presence
    .filter((entry) => !entry.present && entry.gates.length > 0)
    .map((entry) => ({ tool: entry.tool.id, why: 'missing' as const }))
}

export function describePresence(
  entry: ToolPresence,
  pathsLosingCoverage: number,
): readonly string[] {
  if (entry.present) {
    return [`tool      ${entry.tool.id} ${entry.tool.version}`.padEnd(34) + `${entry.at ?? ''}`]
  }
  return [
    `tool      ${entry.tool.id} ${entry.tool.version}`.padEnd(34) + 'missing',
    `          gates  ${entry.gates.join(', ')}`,
    `          effect ${pathsLosingCoverage} path(s) lose an inspection`,
    `          fix    ${fixFor(entry.tool)}`,
  ]
}

function fixFor(tool: ToolRequirement): string {
  return tool.provider === 'host'
    ? `install ${tool.id} on this machine; gspot cannot ship it`
    : 'gspot install'
}
