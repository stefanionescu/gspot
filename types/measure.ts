import type { Candidate, PathStatus, TrackedFiles } from 'types/coverage'
import type { Declaration, SettingsDocument, ScopeSelection } from 'types/settings'
import type { PathAttributes } from 'types/coverage'

export type Measurement = {
  readonly tracked: TrackedFiles
  readonly candidates: readonly Candidate[]
  readonly statuses: readonly PathStatus[]
  readonly untracked: readonly string[]
  readonly failures: readonly { readonly check: string; readonly reason: string }[]
  readonly unread: ReadonlyMap<string, string>
}

export type MeasureInputs = {
  readonly root: string
  readonly settings: SettingsDocument
  readonly scopes: readonly ScopeSelection[]
  readonly frozen: ReadonlySet<string>
  readonly banners: readonly string[]
  readonly configArgs: ReadonlyMap<string, readonly string[]>
  readonly ruleSets: ReadonlyMap<string, string>
}

export type ClassifyInputs = {
  readonly root: string
  readonly declarations: readonly Declaration[]
  readonly attributes: ReadonlyMap<string, PathAttributes>
  readonly frozen: ReadonlySet<string>
  readonly banners: readonly string[]
}
