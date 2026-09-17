import type { CiProvider, Runner } from 'types/settings'
import type { InitFlags } from 'types/commands'
import { optional } from '@/settings/optional'

export type InitFlagInput = {
  yes?: boolean
  presets?: string[]
  runner?: string
  hooks?: string
  ci?: string
  rules?: string
}

export type CheckFlagInput = {
  stage?: string
  scope?: string
  inspects?: string
  since?: string
  skip?: string[]
  unchecked?: boolean
}

export function readInitFlags(flags: InitFlagInput): InitFlags {
  return {
    ...optional('presets', flags.presets as readonly string[] | undefined),
    ...optional('runner', flags.runner as Runner | undefined),
    ...optional('hooks', yesNo(flags.hooks)),
    ...optional('ci', flags.ci as CiProvider | undefined),
    ...optional('rules', yesNo(flags.rules)),
  }
}

function yesNo(answer: string | undefined): boolean | undefined {
  if (answer === undefined) return undefined
  return answer === 'yes' || answer === 'true'
}
