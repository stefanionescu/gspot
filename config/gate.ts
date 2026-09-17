import type { Inspection } from 'types/manifest'

export const NEVER_BASELINED: readonly Inspection[] = [
  'format',
  'syntax',
  'schema',
  'security',
  'dependencies',
]
