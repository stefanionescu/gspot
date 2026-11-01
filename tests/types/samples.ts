import type { RunReport } from '#cli/types/engine/run.ts';
import type { Finding } from '#cli/types/engine/tool-runs.ts';
import { type ProcessOutput } from '#tests/types/processes.ts';

type SampleFinding = Partial<Pick<Finding, 'file' | 'rule' | 'line' | 'column' | 'message'>>;

export type SampleFix = {
    files: Record<string, string>;
    settings?: string;
    removed?: readonly string[] | undefined;
};

export type CheckSample = SandboxChanges & {
    check: string;
    expected: SampleFinding;
    findings?: readonly SampleFinding[];
    corrected?: SampleFix;
};

export type SampleResult = {
    failed: ProcessOutput & { report: RunReport };
    passed: ProcessOutput & { report: RunReport };
};

export type SandboxChanges = {
    files: Record<string, string>;
    settings?: string | undefined;
    removed?: readonly string[] | undefined;
    executable?: readonly string[] | undefined;
};
