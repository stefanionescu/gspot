import type { Finding } from '#cli/types/parsers/output.ts';

/** The fixture contract owned by this behavior's tests. */
export type TypecheckOutcome = { code: number; output: string; findings: Finding[] };
