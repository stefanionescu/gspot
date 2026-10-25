import type { FixReport } from '#cli/types/runs/fixes.ts';
import type { CheckSession } from '#cli/types/session.ts';
import type { CheckResult } from '#cli/types/runs/check.ts';
import type { IgnoreRecord } from '#cli/types/settings/file.ts';
import type { PushInput } from '#cli/types/repository/revisions.ts';
import type { PlanOptions, StageFilter, PlannedCheck } from '#cli/types/planning.ts';

export type RunOptions = PlanOptions & {
    stage: StageFilter;
    onProgress?: (progress: CheckProgress) => void;
    isDryRun: boolean;
    comparison?: NonNullable<RunReport['comparison']>;
    unstagedChanges?: number;
    cwd: string;
    pathArguments: string[];
    push?: PushInput | undefined;
    fix: boolean;
    verbose?: boolean;
};

export type Run = {
    session: CheckSession;
    options: RunOptions;
};

export type RunResult = { report: RunReport; planned: PlannedCheck[]; fixes?: FixReport };

export type RunReport = {
    notes?: string[];
    comparison?: { content: 'working-tree' | 'index' | 'commit'; reference: string };
    version: string;
    stage: StageFilter;
    started: string;
    duration: number;
    checks: readonly CheckResult[];
    ignores: readonly (Omit<IgnoreRecord, 'until'> & { until?: string })[];
    unstagedChanges: number;
    partial: boolean;
    failed: readonly string[];
    exitCode: number;
};

export type PlanAfterFixes = { session: CheckSession; planned: PlannedCheck[]; fixes: FixReport | undefined };

export type CheckProgress = { finished: number; total: number; comparison: RunReport['comparison'] };
