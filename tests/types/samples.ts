import type { RunReport } from '#cli/types/runs/run.ts';
import type { ProcessOutput } from '#tests/types/processes.ts';
import type { Finding, CheckResult } from '#cli/types/runs/check.ts';

type SampleFinding = Partial<Pick<Finding, 'file' | 'rule' | 'line' | 'column' | 'message'>>;

export type SampleFix = {
    files: Record<string, string>;
    settings?: string;
    removed?: readonly string[] | undefined;
};

export type CheckSample = SampleChanges & {
    expected: SampleFinding;
    findings?: readonly SampleFinding[];
    corrected?: SampleFix;
};

export type GspotCall = (
    cwd: string,
    commandArguments: readonly string[],
    environment?: Record<string, string>,
) => Promise<ProcessOutput>;

export type SampleResult = {
    failed: ProcessOutput & { report: RunReport };
    passed: ProcessOutput & { report: RunReport };
};

export type SampleChanges = {
    check: string;
    files: Record<string, string>;
    settings?: string | undefined;
    removed?: readonly string[] | undefined;
    executable?: readonly string[] | undefined;
};

export type OriginalFile = { kind: 'file'; bytes: Uint8Array; mode: number } | { kind: 'symlink'; target: string };

export type SampleSummary = {
    failed: { code: number; reported: readonly CheckResult[] };
    passed: { code: number; reported: readonly CheckResult[] };
};

export type SizeCase = { file: string; rule: string; line: number; source: string; corrected: string; message: string };
