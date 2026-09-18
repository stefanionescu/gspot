// The record of one run: .gspot/last.json and the output of check --json.

import type { CheckResult } from '#types/finding.ts';

export type BaselineVerdict = {
    check: string;
    rule: string;
    count: number;
    baseline: number;
    held: boolean;
};

export type RunRecord = {
    version: string;
    stage: string;
    started: string;
    duration: number;
    root: string;
    checks: CheckResult[];
    baselines: BaselineVerdict[];
    ignores: { check: string; rule?: string; paths?: string[]; reason: string; matched: number }[];
    skips: { check: string; source: 'local' | 'flag' | 'platform' | 'rules' }[];
    inspection: { checked: number; unchecked: number };
    suppressions: Record<string, number>;
    unstaged: number;
    failed: string[];
    exitCode: number;
};
