import type { Finding } from '#cli/types/execution/runtime.ts';

/** The fixture contract owned by this behavior's tests. */
export type TypecheckOutcome = { code: number; output: string; findings: Finding[] };
