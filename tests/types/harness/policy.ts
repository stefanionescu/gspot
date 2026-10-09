import type { Level } from '#cli/types/configurations.ts';

/** Authored policy choices for a sandbox; agent rules use public defaults only when the caller opts in. */
export type PolicyOptions = { level?: Level; tables?: string; agentRules?: boolean };
