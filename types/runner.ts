import type { HOOK_NAMES } from '@config/hooks'

export type HookName = (typeof HOOK_NAMES)[number]

export type MiseLayout = {
  readonly configs: readonly string[]
  readonly taskDirectory: string
  readonly existingTasks: readonly string[]
}

export type EmittedTask = {
  readonly path: string
  readonly name: string
  readonly body: string
}

export type HookOutcome = {
  readonly written: readonly string[]
  readonly refused: readonly string[]
}
