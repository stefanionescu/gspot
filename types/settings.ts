import type { Check, Direction, Operation, Preset } from 'types/manifest'
import type { Selector } from 'types/paths'

export const RUNNERS = ['mise', 'bun', 'npm'] as const
export type Runner = (typeof RUNNERS)[number]

export const CI_PROVIDERS = ['none', 'github', 'gitlab', 'buildkite'] as const
export type CiProvider = (typeof CI_PROVIDERS)[number]

export type Gate = { readonly hooks: boolean; readonly ci: CiProvider }

export type Scope = { readonly path: string; readonly presets: readonly string[] }

export type Declaration = {
  readonly paths: Selector
  readonly producedBy?: string
  readonly reason?: string
}

export type Exception = {
  readonly check: string
  readonly reason: string
  readonly rule?: string
  readonly paths?: Selector
  readonly symbol?: string
  readonly finding?: string
}

export type Suppressible = {
  readonly check: string
  readonly path?: string

  readonly rule?: string

  readonly symbol?: string

  readonly finding?: string
}

export type ConsumerCheck = { readonly check: Check; readonly paths: Selector }

export type SettingsDocument = {
  readonly version: number
  readonly runner: Runner
  readonly gate: Gate
  readonly presets: readonly string[]
  readonly scopes: readonly Scope[]
  readonly declarations: readonly Declaration[]
  readonly exceptions: readonly Exception[]
  readonly checks: readonly ConsumerCheck[]
  readonly tables: ReadonlyMap<string, Readonly<Record<string, unknown>>>
  readonly source: string
}

export type LocalSettings = { readonly skip: readonly string[] }

export type SettingEntry = {
  readonly name: string
  readonly operation: Operation
  readonly value: unknown
  readonly where: string
  readonly scope: string
}

export type ResolvedSetting = {
  readonly name: string
  readonly value: unknown
  readonly direction: Direction
  readonly sources: readonly string[]
}

export type DeadEntry = { readonly entry: SettingEntry; readonly why: string }

export type Loosening = { readonly name: string; readonly reason: string }

export type Merged = {
  readonly settings: ReadonlyMap<string, ResolvedSetting>
  readonly dead: readonly DeadEntry[]
  readonly loosenings: readonly Loosening[]
}

export type ScopeSelection = { readonly path: string; readonly presets: readonly Preset[] }

export type Policy = {
  readonly root: string
  readonly settings: SettingsDocument
  readonly scopes: readonly ScopeSelection[]
  readonly presets: readonly Preset[]
  readonly merged: Merged
  readonly localSkips: ReadonlySet<string>
}

export type Selection = {
  readonly presets: readonly Preset[]
  readonly implied: readonly string[]
}
