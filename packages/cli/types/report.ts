// The report of one run: .gspot/report.json and the output of check --json.

import type { CheckResult } from '#types/finding.ts';

export type BaselineVerdict = {
    check: string;
    rule: string;
    count: number;
    baseline: number;
    held: boolean;
    /** How many findings of the rule each file holds in this run, which is what lowering a baseline writes. */
    paths: Record<string, number>;
};

export type RunReport = {
    comparison?: { content: 'working-tree'; reference: string };
    version: string;
    stage: string;
    started: string;
    duration: number;
    checks: CheckResult[];
    baselines: BaselineVerdict[];
    ignores: { check: string; rule?: string; paths?: string[]; reason: string; matched: number }[];
    skips: { check: string; source: 'local' | 'flag' | 'platform' | 'rules' }[];
    coverage: { checked: number; unchecked: number };
    suppressions: Record<string, number>;
    unstaged: number;
    /** True when the run read only the staged files or the files a ref does not hold yet, so its counts are partial. */
    narrowed: boolean;
    failed: string[];
    exitCode: number;
};
