import type { Candidate, TrackedFiles } from 'types/coverage'
import type { CiProvider, Runner, Scope } from 'types/settings'
import type { MANIFEST_NAMES } from '@config/detection'

export type ManifestName = (typeof MANIFEST_NAMES)[number]

export type Manifest = {
  readonly path: string
  readonly name: ManifestName
  readonly directory: string
  readonly dependencies: readonly string[]
  readonly tables: readonly string[]
}

export type Proposal = {
  readonly preset: string
  readonly evidence: string
  readonly scope: string
}

export type Detection = {
  readonly proposals: readonly Proposal[]
  readonly extensions: ReadonlyMap<string, number>
  readonly unclaimed: readonly { readonly extension: string; readonly count: number }[]
  readonly scopes: readonly string[]
}

export type ExistingTool = {
  readonly tool: string
  readonly config: string
  readonly ownable: boolean
}

export type Reading = {
  readonly root: string
  readonly tracked: TrackedFiles
  readonly candidates: readonly Candidate[]
  readonly manifests: readonly Manifest[]
  readonly detection: Detection
  readonly runner: Runner | null
  readonly hookRunner: string | null
  readonly ci: string | null
  readonly agentRules: readonly string[]
  readonly existingTools: readonly ExistingTool[]
}

export type DeclarationAnswer = { readonly paths: readonly string[]; readonly reason: string }

export type Answers = {
  readonly runner: Runner
  readonly presets: readonly string[]
  readonly scopes: readonly Scope[]
  readonly ownedTools: readonly string[]
  readonly declarations: readonly DeclarationAnswer[]
  readonly hooks: boolean
  readonly ci: CiProvider
  readonly rules: boolean
}

export type PlanEntry = { readonly path: string; readonly note: string }

export type Plan = {
  readonly writes: readonly PlanEntry[]
  readonly deletes: readonly PlanEntry[]
  readonly changes: readonly PlanEntry[]
  readonly leaveAlone: readonly PlanEntry[]
  readonly settings: string
}
