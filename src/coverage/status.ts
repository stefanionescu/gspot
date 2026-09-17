import { exceptionFor } from '@/settings/declaration'
import { WEAK_INSPECTIONS, type Inspection } from 'types/manifest'
import type { Classification, Nature } from 'types/coverage'
import type { Exception } from 'types/settings'
import type { Status } from 'types/coverage'
import type { Claim, PathStatus } from 'types/coverage'

const REQUIRED_BY_NATURE: Readonly<Record<Exclude<Nature, 'source'>, readonly Inspection[]>> = {
  vendored: ['security', 'dependencies'],
  generated: ['security', 'freshness'],
  frozen: ['security', 'freshness'],
  binary: ['security'],
}

export type StatusInputs = {
  readonly classification: Classification
  readonly claims: readonly Claim[]

  readonly required: readonly Inspection[]
  readonly exceptions: readonly Exception[]
}

export function statusOf(inputs: StatusInputs): PathStatus {
  const { classification: what, claims } = inputs
  const path = what.path
  const unverified = claims.some((claim) => claim.via === 'declared')
  const at = { path, claims, unverified }

  const excepted = exceptionFor(inputs.exceptions, { check: 'coverage', path })
  if (excepted !== undefined) {
    return { ...at, status: 'excepted', missing: [], reason: excepted.reason }
  }

  if (what.nature !== 'source') {
    return byNature(at, what, REQUIRED_BY_NATURE[what.nature])
  }
  if (claims.length === 0) {
    return { ...at, status: 'unchecked', missing: inputs.required }
  }

  if (claims.every((claim) => claim.supplier)) {
    return { ...at, status: 'unchecked', missing: inputs.required }
  }

  const missing = shortfall(claims, inputs.required)
  if (missing.length > 0) return { ...at, status: 'partial', missing }
  if (onlyWeak(claims)) return { ...at, status: 'partial', missing: inputs.required }
  return { ...at, status: 'covered', missing: [] }
}

type Anchor = { readonly path: string; readonly claims: readonly Claim[]; readonly unverified: boolean }

function byNature(at: Anchor, what: Classification, required: readonly Inspection[]): PathStatus {
  const status = what.nature as Status
  const missing = shortfall(at.claims, required)
  return { ...at, status, missing, ...(what.reason === undefined ? {} : { reason: what.reason }) }
}

function shortfall(claims: readonly Claim[], required: readonly Inspection[]): readonly Inspection[] {
  const provided = new Set(claims.flatMap((claim) => claim.inspects))
  return required.filter((inspection) => !provided.has(inspection))
}

function onlyWeak(claims: readonly Claim[]): boolean {
  return claims.every((claim) =>
    claim.inspects.every((inspection) => WEAK_INSPECTIONS.includes(inspection)),
  )
}

export function unreadReason(entry: PathStatus): string {
  if (entry.claims.length === 0) return 'no check reads it'
  return 'no selected preset says what this file is, so nothing can call it covered'
}
