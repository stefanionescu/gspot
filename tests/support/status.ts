import { statusOf } from '@/coverage/status'
import type { Claim, Classification, Nature, PathStatus } from 'types/coverage'
import type { Inspection } from 'types/manifest'
import type { Exception } from 'types/settings'

export const PATH = 'src/module.ts'

export function classified(nature: Nature, extra: Partial<Classification> = {}): Classification {
  return { path: PATH, nature, from: 'default', ...extra }
}

export function claim(check: string, inspects: Inspection[]): Claim {
  return { check, path: PATH, inspects, via: 'check-mode', supplier: false }
}

export function supplied(check: string, inspects: Inspection[]): Claim {
  return { ...claim(check, inspects), supplier: true }
}

export function decide(
  classification: Classification,
  claims: Claim[],
  required: Inspection[],
  exceptions: Exception[] = [],
): PathStatus {
  return statusOf({ classification, claims, required, exceptions })
}
