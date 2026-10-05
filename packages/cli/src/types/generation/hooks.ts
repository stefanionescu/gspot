import type { HOOK_ARGS } from '#cli/config/generation/hooks.ts';

export type HookName = keyof typeof HOOK_ARGS;
