import type { RunReport } from '#cli/types/execution/check.ts';

/** The fixture contract owned by this behavior's tests. */
export type ComparisonCase = { content: NonNullable<RunReport['comparison']>['content']; header: string };
