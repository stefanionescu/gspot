import type { Finding } from '#cli/types/parsers/output.ts';

export type TypecheckOutcome = { code: number; output: string; findings: Finding[] };
