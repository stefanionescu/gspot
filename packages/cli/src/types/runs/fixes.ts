export type FixResult = { check: string; changed: string[] } & (
    | { status: 'changed' | 'unchanged' | 'skipped' }
    | { status: 'failed'; note: string }
);

export type FixReport = { results: FixResult[]; changed: string[]; broken: string[]; diffs: string[] };

/** A preview fixes a copy and reports differences. */
export type FixOptions = { isDryRun: boolean };
