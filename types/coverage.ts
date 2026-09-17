import type { FileListMechanism, Inspection } from 'types/manifest'

export type TrackedPath = {
  readonly path: string
  readonly gitMode: 'file' | 'executable' | 'symlink'
}

export type TrackedLink = {
  readonly path: string
  readonly target: string
  readonly inside: string | null
}

export type TrackedFiles = {
  readonly root: string
  readonly paths: readonly TrackedPath[]
  readonly links: readonly TrackedLink[]
  readonly submodules: readonly string[]
}

export type Candidate = {
  readonly path: string
  readonly extension: string
  readonly interpreter: string | null
}

export type CandidateSet = {
  readonly candidates: readonly Candidate[]
  readonly claimed: ReadonlyMap<string, readonly string[]>
  readonly unclaimed: readonly string[]
}

export type PathAttributes = {
  readonly generated: boolean
  readonly vendored: boolean
  readonly notText: boolean
  readonly filter: string | null
}

export type Nature = 'source' | 'generated' | 'vendored' | 'frozen' | 'binary'

export type Classification = {
  readonly path: string
  readonly nature: Nature
  readonly from: 'declaration' | 'attribute' | 'banner' | 'content' | 'default'
  readonly producedBy?: string
  readonly reason?: string
}

export type Claim = {
  readonly check: string
  readonly path: string
  readonly inspects: readonly Inspection[]
  readonly via: FileListMechanism
  readonly supplier: boolean
}

export const STATUSES = [
  'covered',
  'partial',
  'generated',
  'vendored',
  'frozen',
  'binary',
  'excepted',
  'unchecked',
  'orphan',
] as const
export type Status = (typeof STATUSES)[number]

export const FAILING_STATUSES: readonly Status[] = ['partial', 'unchecked', 'orphan']

export type PathStatus = {
  readonly path: string
  readonly status: Status
  readonly claims: readonly Claim[]
  readonly missing: readonly Inspection[]
  readonly unverified: boolean
  readonly reason?: string
}

export type Listing = {
  readonly via: FileListMechanism
  readonly paths: ReadonlySet<string>
  readonly untracked: readonly string[]
  readonly ignored: readonly string[]
  readonly failure?: string
}

export type IgnorePattern = {
  readonly text: string
  readonly source: string
  readonly line: number
  readonly negated: boolean
  readonly directoryOnly: boolean
  readonly matches: (path: string) => boolean
}

export type IgnoreVerdict = {
  readonly ignored: boolean
  readonly pattern: IgnorePattern
  readonly at: string
}

export type IgnoreSource = {
  readonly directory: string
  readonly patterns: readonly IgnorePattern[]
}

export type CoverageRow = {
  readonly status: Status
  readonly checks: readonly {
    readonly check: string
    readonly inspects: readonly string[]
    readonly fileList: string
  }[]
  readonly missing?: readonly string[]
  readonly reason?: string
  readonly unverified?: boolean
}

export type CoverageTable = {
  readonly version: number
  readonly generatedAt: string
  readonly gspot: string
  readonly trackedFiles: number
  readonly submodules: number
  readonly summary: Readonly<Record<Status, number>>
  readonly paths: Readonly<Record<string, CoverageRow>>
}

export type Regression = {
  readonly path: string
  readonly was: Status | 'absent'
  readonly now: Status
}

export type CoverageCounts = {
  readonly unchecked: number
  readonly partial: number
  readonly orphan: number
}
