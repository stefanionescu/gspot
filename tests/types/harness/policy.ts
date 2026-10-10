import type { Level } from '#cli/types/configurations.ts';
import type { RawPolicy } from '#cli/types/policy/settings.ts';

/** Authored policy choices for a sandbox; agent rules use public defaults only when the caller opts in. */
export type PolicyOptions = { level?: Level; tables?: string; agentRules?: boolean };

export type ReportingCheck = NonNullable<RawPolicy['check']>[string];

export type ReportingCheckOptions = Pick<ReportingCheck, 'paths' | 'stage'>;
