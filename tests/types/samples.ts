import type { RunReport } from '#cli/types/runs/run.ts';
import type { ProcessOutput } from '#tests/types/processes.ts';
import type { Finding, CheckResult } from '#cli/types/runs/check.ts';

// The fields of a finding that a sample names.
type SampleFinding = Partial<Pick<Finding, 'file' | 'rule' | 'line' | 'column' | 'message'>>;

/** What the clean rerun of a test case writes: corrected files, and the case's settings unless it names another. */
export type SampleFix = {
    files: Record<string, string>;
    /** TOML tables appended to the installed settings. */
    settings?: string;
    removed?: readonly string[] | undefined;
};

/** A test case that checks a finding at its source location, and what corrects it for the clean rerun. */
export type CheckSample = SampleChanges & {
    expected: SampleFinding;
    /** Every finding of the sample in report order, when the tool reports more than the expected one. */
    findings?: readonly SampleFinding[];
    /** What the clean rerun writes instead; the case's settings with no files unless a case says otherwise. */
    corrected?: SampleFix;
};

/** How a test runs gspot: in this process or as a child. */
export type GspotCall = (
    cwd: string,
    commandArguments: readonly string[],
    environment: Record<string, string>,
) => Promise<ProcessOutput>;

/** Process results and reports for the failing run and its clean rerun. */
export type SampleResult = {
    failed: ProcessOutput & { report: RunReport };
    passed: ProcessOutput & { report: RunReport };
};

/** The files and settings needed to apply a sample for one check. */
export type SampleChanges = {
    check: string;
    files: Record<string, string>;
    /** TOML tables appended to the installed gspot.toml. */
    settings?: string | undefined;
    removed?: readonly string[] | undefined;
    executable?: readonly string[] | undefined;
};

/** The original bytes, or the path a link points to, restored after a test edit. */
export type OriginalFile = { kind: 'file'; bytes: Uint8Array; mode: number } | { kind: 'symlink'; target: string };

/** Exit codes and check results of the broken and corrected samples. */
export type SampleSummary = {
    failed: { code: number; reported: readonly CheckResult[] };
    passed: { code: number; reported: readonly CheckResult[] };
};

/** One Bash function-size boundary, its diagnostic, and the corrected source. */
export type SizeCase = { file: string; rule: string; line: number; source: string; corrected: string; message: string };
