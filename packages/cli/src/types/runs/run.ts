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
    /** Working-tree changes omitted when this run reads staged content. */
    unstagedChanges?: number;
};

export type RunState = {
    session: Session;
    options: RunOptions;
};

export type RunOptions = RunReportOptions & {
    push?: PushInput | undefined;
    fix: boolean;
};

export type RunResult = { report: RunReport; planned: PlannedCheck[]; fixes?: FixReport };

/** The run report as check --json prints it. */
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
    /** How many changed files the run left out: the unstaged ones when it read the index. */
    unstagedChanges: number;
    /** Whether the run read only part of the repository: the staged files, a change set, or named paths. */
    partial: boolean;
    /** The checks that failed, with the checks whose fixer failed although the check passed. */
    failed: readonly string[];
    exitCode: number;
};

/** The checks and fixer results for the run after the fixes. */
export type PlanAfterFixes = { planned: PlannedCheck[]; fixes: FixReport | undefined };

/** The finished check count and the comparison, for terminal progress. */
export type CheckProgress = { completed: number; total: number; comparison: RunReport['comparison'] };
