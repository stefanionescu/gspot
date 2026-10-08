import type { ESLint } from 'eslint';

/** Each overlap scenario retains its native configuration observation and exact finding coordinates. */
export type OverlapCase = {
    name: string;
    project: Record<string, string>;
    names: string[];
    patterns: string[];
    correction: string;
    expected: Record<string, unknown>;
    files: Array<{ file: string; findings: Array<{ ruleId: string; line: number; column: number; severity: number }> }>;
    configuration: (eslint: ESLint, names: string[]) => Promise<Record<string, unknown>>;
};
