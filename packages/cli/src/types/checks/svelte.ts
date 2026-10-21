import type { SVELTE_SEVERITIES } from '#cli/config/checks/svelte.ts';

export type SvelteFinding = {
    type: (typeof SVELTE_SEVERITIES)[number];
    filename: string;
    start: { line: number; character: number };
    message: string;
    code?: string | number | undefined;
};
