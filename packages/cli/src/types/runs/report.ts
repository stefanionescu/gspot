import type { Session } from '#cli/types/session.ts';
import type { RunOptions } from '#cli/types/runs/run.ts';
import type { FixReport } from '#cli/types/runs/fixes.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { CheckResult } from '#cli/types/runs/check.ts';

export type FinishedRun = {
    session: Session;
    options: RunOptions;
    started: Date;
    planned: PlannedCheck[];
    active: PlannedCheck[];
    ran: CheckResult[];
    fixes: FixReport | undefined;
};

export type ReproduceOptions = {
    paths: string[];
    changed: string | undefined;
    messageFile: string | undefined;
    staged: boolean;
};
