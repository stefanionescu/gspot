import type { Session } from '#cli/types/session.ts';
import type { FixReport } from '#cli/types/runs/fixes.ts';
import type { CheckResult } from '#cli/types/runs/check.ts';
import type { PushInput } from '#cli/types/repository/revisions.ts';
import type { PlanOptions, StageFilter, PlannedCheck } from '#cli/types/planning.ts';

export type RunReportOptions = PlanOptions & {
    stage: StageFilter;
    onProgress?: (progress: CheckProgress) => void;
    isDryRun: boolean;
    comparison?: NonNullable<RunReport['comparison']>;
    unstagedChanges?: number;
};

export type Run = {
    session: Session;
    options: RunOptions;
};

export type RunOptions = RunReportOptions & {
    push?: PushInput | undefined;
    fix: boolean;
};

export type RunResult = { report: RunReport; planned: PlannedCheck[]; fixes?: FixReport };

export type RunReport = {
    comparison?: { content: 'working-tree' | 'index' | 'commit'; reference: string };
    version: string;
    stage: StageFilter;
    started: string;
    duration: number;
    checks: readonly CheckResult[];
    ignores: readonly {
        check?: string;
        rule?: string;
        paths?: readonly string[];
        names?: readonly string[];
        reason: string;
    }[];
    unstagedChanges: number;
    partial: boolean;
    failed: readonly string[];
    exitCode: number;
};

export type PlanAfterFixes = { planned: PlannedCheck[]; fixes: FixReport | undefined };

export type CheckProgress = { finished: number; total: number; comparison: RunReport['comparison'] };
