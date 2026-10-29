import type { Finding } from '#cli/types/runs/check.ts';

export type FindingRow = { file: string; line: number | undefined; rule: string | undefined };

export type ScopeFindingRow = FindingRow & { scope: string };

export type LinkFailure = { scope: string; file: string; rule: string };

export type TypecheckResult = { code: number; output: string; findings: Finding[] };
