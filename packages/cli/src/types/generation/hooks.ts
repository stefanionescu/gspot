import type { HOOK_FILES } from '#cli/config/generation/hooks.ts';

export type HookName = (typeof HOOK_FILES)[number];
