import type { HOOK_ARGS } from '#cli/config/generation/hooks.ts';

export type HookName = keyof typeof HOOK_ARGS;

/** The command and installation instructions for a generated hook's runner. */
export type HookRunner = { command: string; acquisition: string };
