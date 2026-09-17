import type { LimitPlan } from 'types/structure'
import type { Selector } from 'types/paths'

export const INSPECTIONS = [
  'format',
  'syntax',
  'schema',
  'style',
  'types',
  'structure',
  'naming',
  'prose',
  'spelling',
  'security',
  'dependencies',
  'duplication',
  'links',
  'accessibility',
  'output',
  'freshness',
] as const
export type Inspection = (typeof INSPECTIONS)[number]

export const WEAK_INSPECTIONS: readonly Inspection[] = ['spelling', 'security']

export const PRESET_KINDS = [
  'language',
  'framework',
  'library',
  'tool',
  'database',
  'platform',
  'repository',
] as const
export type PresetKind = (typeof PRESET_KINDS)[number]

export const STAGES = ['pre-commit', 'pre-push', 'commit-msg', 'ci', 'release'] as const
export type Stage = (typeof STAGES)[number]

export const REQUIREMENTS = ['build', 'docker', 'network'] as const
export type Requirement = (typeof REQUIREMENTS)[number]

export const TAKES = ['one-file', 'file-list', 'project'] as const
export type Takes = (typeof TAKES)[number]

export const FAILS_ON = ['exit-code', 'finding-count', 'parsed-output'] as const
export type FailsOn = (typeof FAILS_ON)[number]

export const FILE_LIST_MECHANISMS = [
  'file-list',
  'print-config',
  'project-graph',
  'check-mode',
  'ignore-replay',
  'declared',
] as const
export type FileListMechanism = (typeof FILE_LIST_MECHANISMS)[number]

export const MECHANISMS = ['configured', 'rule-file', 'plugin', 'original'] as const
export type Mechanism = (typeof MECHANISMS)[number]

export const FIX_STAGES = ['codemod', 'imports', 'manifest', 'format'] as const
export type FixStage = (typeof FIX_STAGES)[number]

export const PROVIDERS = ['npm', 'download', 'uv', 'pipx', 'github', 'host'] as const
export type Provider = (typeof PROVIDERS)[number]

export const OPERATIONS = ['add', 'remove', 'set'] as const
export type Operation = (typeof OPERATIONS)[number]

export const DIRECTIONS = ['loosening', 'tightening', 'neutral', 'ceiling', 'declared-per-rule'] as const
export type Direction = (typeof DIRECTIONS)[number]

export const SKIP_PREDICATES = ['linux-only', 'macos-only', 'docker-daemon'] as const
export type SkipPredicate = (typeof SKIP_PREDICATES)[number]

export type ToolRequirement = {
  readonly id: string
  readonly version: string
  readonly provider: Provider
  readonly package?: string
  readonly url?: string
}

export type ConfigArtifact = {
  readonly target: string
  readonly template: string
  readonly readers: readonly string[]
  readonly stub?: string
  readonly stubKind?: string
}

export type ToolError = {
  readonly regex: string
  readonly message: string
}

export type FileListPlan = {
  readonly via: FileListMechanism
  readonly command?: readonly string[]
  readonly pathRegex?: string
  readonly ignoredRegex?: string
  readonly ignoreFiles?: readonly string[]
}

export type Check = {
  readonly id: string
  readonly inspects: readonly Inspection[]
  readonly mechanism: Mechanism
  readonly stage: Stage
  readonly takes: Takes
  readonly command?: readonly string[]
  readonly rules?: string
  readonly builtin?: string
  readonly paths?: Selector
  readonly limit?: LimitPlan
  readonly failsOn: FailsOn
  readonly countRegex?: string
  readonly fileList: FileListPlan
  readonly requires: readonly Requirement[]
  readonly invocationModes: readonly Takes[]
  readonly toolErrors: readonly ToolError[]
  readonly fix?: readonly string[]
  readonly fixStage?: FixStage
  readonly skipWhen?: string
  readonly tools: readonly string[]
  readonly configArg?: string
  readonly searched?: readonly string[]
  readonly justification?: string
}

export type SettingSlot = {
  readonly name: string
  readonly ops: readonly Operation[]
  readonly direction: Direction
}

export type TaskNode = {
  readonly name: string
  readonly description: string
  readonly checks: readonly string[]
  readonly scope: 'per-scope' | 'repo'
  readonly deps: readonly string[]
}

export type Claims = {
  readonly extensions: readonly string[]
  readonly filenames: readonly string[]
  readonly interpreters: readonly string[]
}

export type Preset = {
  readonly id: string
  readonly kind: PresetKind
  readonly supplies: boolean
  readonly title: string
  readonly requires: readonly string[]
  readonly conflicts: readonly string[]
  readonly shared: readonly string[]
  readonly claims: Claims
  readonly required: ReadonlyMap<string, readonly Inspection[]>
  readonly tools: readonly ToolRequirement[]
  readonly configs: readonly ConfigArtifact[]
  readonly checks: readonly Check[]
  readonly settings: readonly SettingSlot[]
  readonly defaults: ReadonlyMap<string, unknown>
  readonly tasks: readonly TaskNode[]
  readonly rules: ReadonlyMap<string, readonly string[]>
  readonly source: string
}
