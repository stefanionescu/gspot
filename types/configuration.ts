import type { ResolvedSetting } from 'types/settings'

export type GeneratedFile = {
  readonly path: string
  readonly contents: string
  readonly readers: readonly string[]
  readonly isStub: boolean
}

export type RenderInputs = {
  readonly template: string
  readonly settings: ReadonlyMap<string, ResolvedSetting>
  readonly version: string
  readonly target: string
  readonly source: string
}

export const DRIFT_KINDS = ['edited', 'absent', 'empty-glob', 'missing-referent', 'orphan'] as const
export type DriftKind = (typeof DRIFT_KINDS)[number]

export type DriftFinding = {
  readonly kind: DriftKind
  readonly path: string
  readonly message: string
}
