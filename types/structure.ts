export type StructureRule = {
  readonly id: string
  readonly language: string
  readonly message: string
  readonly rule: Readonly<Record<string, unknown>>
  readonly constraints?: Readonly<Record<string, unknown>>
  readonly utils?: Readonly<Record<string, unknown>>
  readonly source: string
}

export type CountMeasure = (typeof import('@config/structure').COUNT_MEASURES)[number]

export type LimitPlan = {
  readonly setting: string
  readonly measure?: CountMeasure
}

export type Position = {
  readonly line: number
  readonly column: number
}

export type StructureFinding = {
  readonly rule: string
  readonly path: string
  readonly at: Position
  readonly message: string

  readonly text: string
  readonly symbol?: string
}

export type StructureOutcome = {
  readonly findings: readonly StructureFinding[]

  readonly read: readonly string[]

  readonly broken: readonly BrokenSource[]
}

export type BrokenSource = {
  readonly path: string
  readonly at: Position
  readonly offset: number
  readonly kind: string
  readonly text: string
}
