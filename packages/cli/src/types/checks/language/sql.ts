import type { SqlFile } from '#cli/types/parsers/sql.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';

export type SqlSource = { path: string; text: string };

export type SqlFileInput = {
    input: CheckInput;
    source: SqlSource;
    parsed: SqlFile;
    threshold: number | undefined;
    maximum: number | undefined;
};

/** Findings and measured triviality of one `CREATE FUNCTION` statement. */
export type SqlFunctionFindings = { findings: Finding[]; isTrivial: boolean };
