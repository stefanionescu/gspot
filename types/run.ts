import type { Stage } from 'types/manifest'
import type { Loosening } from 'types/settings'
import type { CoverageCounts } from 'types/coverage'

export type Invocation = {
  readonly command: readonly string[]
  readonly cwd: string
  readonly stdin?: string
  readonly timeoutMs?: number
  readonly env?: Readonly<Record<string, string>>
  readonly outputLimit?: number
}

export type Answer =
  | {
      readonly outcome: 'ran'
      readonly code: number
      readonly stdout: string
      readonly stderr: string
      readonly truncated: boolean
      readonly durationMs: number
    }
  | { readonly outcome: 'missing'; readonly program: string; readonly durationMs: number }
  | { readonly outcome: 'timeout'; readonly timeoutMs: number; readonly durationMs: number }
  | { readonly outcome: 'broke'; readonly message: string; readonly durationMs: number }

export type Skip = {
  readonly reason: string
  readonly platform: boolean
}

export type CheckStatus = 'ran' | 'cached' | 'skipped'

export type CheckResult = {
  readonly check: string
  readonly scope: string
  readonly status: CheckStatus
  readonly findings: number
  readonly pathsRead: number
  readonly durationMs: number
  readonly reason?: string
  readonly platform?: boolean
  readonly output?: string
  readonly brokeBecause?: string

  readonly suppressed?: number

  readonly perPath?: Readonly<Record<string, number>>
}

export type AppliedException = {
  readonly check: string
  readonly reason: string
  readonly narrowedBy: readonly string[]
  readonly covered: number
}

export type GraphNode = {
  readonly name: string
  readonly scope: string
  readonly description: string
  readonly checks: readonly import('types/manifest').Check[]
  readonly deps: readonly string[]
}

export type Suppression = {
  readonly form: string
  readonly path: string
  readonly line: number
  readonly text: string
  readonly reason: string | null
  readonly owned: boolean
}

export type Baseline = {
  readonly check: string
  readonly rule: string
  readonly count: number
  readonly adopted: string
  readonly paths: Readonly<Record<string, number>>
}

export type BaselineVerdict = {
  readonly rule: string
  readonly baseline: number
  readonly count: number
  readonly grew: readonly string[]
  readonly exceeded: boolean
}

export type ToolProblem = { readonly tool: string; readonly why: 'missing' | 'checksum' }

export type Verdict = {
  readonly passed: boolean
  readonly reasons: readonly string[]
  readonly failing: readonly string[]
}

export type RunReport = {
  readonly gspot: string
  readonly stage: Stage | 'all'
  readonly startedAt: string
  readonly durationMs: number
  readonly verdict: 'passed' | 'failed'
  readonly checks: readonly CheckResult[]
  readonly coverage: CoverageCounts
  readonly exceptions: readonly AppliedException[]
  readonly suppressions: Readonly<Record<string, number>>
  readonly baselines: readonly BaselineVerdict[]
  readonly loosenings: readonly Loosening[]
}
