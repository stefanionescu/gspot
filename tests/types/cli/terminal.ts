import type { RunReport } from '#cli/types/execution/check.ts';

export type ComparisonCase = { content: NonNullable<RunReport['comparison']>['content']; header: string };
