import type { Inspection, Stage } from 'types/manifest'
import type { CiProvider, Runner } from 'types/settings'
import type { CoverageTable } from 'types/coverage'
import type { Plan } from 'types/detect'
import type { CheckResult, Verdict } from 'types/run'
import type { DriftFinding, GeneratedFile } from 'types/configuration'
import type { Measurement } from 'types/measure'

export type Surroundings = {
  readonly cwd: string
  readonly presetsRoot: string
  readonly version: string
  readonly interactive: boolean
  readonly write: (line: string) => void
}

export type ExitCode = 0 | 1 | 2

export type Lines = { readonly lines: readonly string[]; readonly code: 0 | 1 }

export type CoverageOptions = {
  readonly cwd: string
  readonly presetsRoot: string
  readonly version: string
  readonly diff: boolean
}

export type CoverageOutcome = {
  readonly table: CoverageTable
  readonly measurement: Measurement
  readonly lines: readonly string[]
  readonly code: 0 | 1
}

export type CheckOptions = {
  readonly cwd: string
  readonly presetsRoot: string
  readonly version: string
  readonly only?: string
  readonly stage?: Stage
  readonly scope?: string
  readonly inspects?: Inspection
  readonly since?: string
  readonly skip: readonly string[]
  readonly unchecked: boolean
}

export type CheckOutcome = {
  readonly verdict: Verdict
  readonly results: readonly CheckResult[]
  readonly lines: readonly string[]
  readonly code: 0 | 1
}

export type GenerateOptions = {
  readonly cwd: string
  readonly presetsRoot: string
  readonly version: string
  readonly check: boolean
}

export type GenerateOutcome = {
  readonly files: readonly GeneratedFile[]
  readonly findings: readonly DriftFinding[]
  readonly lines: readonly string[]
  readonly code: 0 | 1
}

export type InitFlags = {
  readonly presets?: readonly string[]
  readonly runner?: Runner
  readonly hooks?: boolean
  readonly ci?: CiProvider
  readonly rules?: boolean
}

export type InitOptions = {
  readonly cwd: string
  readonly presetsRoot: string
  readonly version: string
  readonly yes: boolean
  readonly flags: InitFlags
  readonly interactive: boolean
  readonly confirm?: (plan: Plan) => Promise<boolean>
}

export type InitOutcome = {
  readonly lines: readonly string[]
  readonly plan: Plan | null
  readonly code: ExitCode
}

export type FixOptions = {
  readonly cwd: string
  readonly presetsRoot: string
  readonly version: string
  readonly only?: string
}

export type FixOutcome = {
  readonly lines: readonly string[]
  readonly results: readonly CheckResult[]
  readonly code: 0 | 1
}

export type ReportOptions = {
  readonly cwd: string
  readonly failed: boolean
  readonly sarif: boolean
  readonly json: boolean
}

export type ConfigOptions = {
  readonly cwd: string
  readonly presetsRoot: string
  readonly tool?: string
}

export type ExplainOptions = {
  readonly cwd: string
  readonly presetsRoot: string
  readonly rule: string
}

export type DoctorOptions = {
  readonly cwd: string
  readonly presetsRoot: string
}

export type InstallOptions = {
  readonly cwd: string
  readonly presetsRoot: string
}

export type HooksOptions = {
  readonly cwd: string
  readonly action: 'install' | 'uninstall'
}

export type UpgradeOptions = {
  readonly cwd: string
  readonly presetsRoot: string
  readonly version: string
  readonly check: boolean
  readonly against?: string
  readonly to?: string
}

export type UpgradeOutcome = {
  readonly lines: readonly string[]
  readonly aborted: boolean
  readonly code: 0 | 1
}

export const SHELLS = ['bash', 'zsh', 'fish'] as const
export type Shell = (typeof SHELLS)[number]
