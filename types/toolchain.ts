import type { ToolRequirement } from 'types/manifest'

export type Asset = {
  readonly url: string
  readonly sha256: string
}

export type LockedTool = {
  readonly id: string
  readonly version: string
  readonly provider: string
  readonly package?: string
  readonly assets: ReadonlyMap<string, Asset>
}

export type Lock = {
  readonly version: number
  readonly tools: ReadonlyMap<string, LockedTool>
}

export type ToolPresence = {
  readonly tool: ToolRequirement
  readonly present: boolean
  readonly at: string | null
  readonly gates: readonly string[]
}

export type ToolNote = { readonly tool: string; readonly why: string }

export type InstallOutcome = {
  readonly installed: readonly string[]
  readonly verified: readonly string[]
  readonly skipped: readonly ToolNote[]
  readonly failures: readonly ToolNote[]
  readonly recorded: readonly string[]
}

export type PinConflict = {
  readonly tool: string
  readonly theirs: string
  readonly ours: string
}
