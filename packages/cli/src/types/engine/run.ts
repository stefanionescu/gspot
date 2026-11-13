import type { LimitFunction } from 'p-limit';
import type { z } from 'zod';

import type { CHECK_STATUSES } from '#cli/config/engine.ts';
import type {
    findingSchema,
    fixReportSchema,
    fixResultSchema,
    reportedCheckSchema,
    runReportSchema,
} from '#cli/schemas/engine.ts';
import type {
    PlannedCheck,
    PlanOptions,
    RunSelection,
    ShippedPlannedCheck,
    StageFilter,
} from '#cli/types/engine/plan.ts';
import type { CommandLine, ConfigTargets } from '#cli/types/engine/tool-runs.ts';
import type { Check } from '#cli/types/manifests.ts';
import type { RuleExplanations, Session } from '#cli/types/tools.ts';

export type Finding = z.infer<typeof findingSchema>;

export type CheckFinding = Omit<Finding, 'check' | 'fixable'> & { fixable?: boolean };

export type FinishedRun = {
    session: Session;
    options: RunOptions;
    comparison: RunReport['comparison'];
    started: Date;
    planned: PlannedCheck[];
    active: PlannedCheck[];
    results: CheckResult[];
    fixes: FixReport | undefined;
};

export type PathBytes = Map<string, Buffer | undefined>;

export type FixRounds = { results: FixResult[]; before: PathBytes; after: PathBytes };

export type FixReport = z.infer<typeof fixReportSchema>;

export type FixResult = z.infer<typeof fixResultSchema>;

export type CheckProgress = {
    finished: number;
    total: number;
    comparison: RunReport['comparison'];
} & (
    | ({ kind: 'finished' } & Pick<CheckResult, 'check' | 'scope' | 'duration'>)
    | { kind: 'running'; running: Array<Pick<CheckResult, 'check' | 'scope'>>; elapsed: number }
);

export type PlanAfterFixes = { session: CheckSession; planned: PlannedCheck[]; fixes: FixReport | undefined };

export type Run = {
    session: CheckSession;
    options: RunOptions;
    comparison: RunReport['comparison'];
    codes: Map<PlannedCheck, CheckCode | undefined>;
    progress: { finished: number; total: number; unfinished: Set<PlannedCheck> };
};

export type RunOptions = PlanOptions & {
    generation: CheckGeneration;
    selectCheckCode: (check: Check) => CheckCode | undefined;
    started?: Date | undefined;
    stage: StageFilter;
    onProgress?: ((progress: CheckProgress) => void) | undefined;
    cwd: string;
    pathArguments: string[];
    fix: boolean;
    verbose?: boolean | undefined;
};

export type RunReport = z.infer<typeof runReportSchema>;

export type RunResult = { report: RunReport; fixes?: FixReport };

export type CheckStatus = (typeof CHECK_STATUSES)[number];

export type CheckCode = (
    { check: BuiltInCheck; fix?: BuiltInFix; run?: never } | { run?: CheckRun; check?: never; fix?: never }
) & {
    explanations?: RuleExplanations;
};

/**
Fix what a built-in check reports, and return the paths it changed. `gspot check --fix` runs it in the working tree,
before the fixer commands.
*/
export type BuiltInFix = (session: CheckSession) => Promise<string[]>;

type CheckRun = (
    session: CheckSession,
    planned: ShippedPlannedCheck,
    options: CheckRunOptions,
) => CheckResult | Promise<CheckResult>;

export type CheckRunOptions = {
    verbose?: boolean | undefined;
    command?: string[];
};

export type BuiltInCheckResult = { findings: CheckFinding[]; files: string[]; notes?: string[] };

export type BuiltInCheck = (
    session: CheckSession,
    planned: PlannedCheck,
    options: CheckRunOptions,
) => CheckFinding[] | BuiltInCheckResult | Promise<CheckFinding[] | BuiltInCheckResult>;

export type CheckResult = z.infer<typeof reportedCheckSchema> & {
    span?: { start: number; end: number };
    reportNotes?: readonly string[];
};

export type CommandLaunch = {
    root: string;
    cwd: string;
    commandArguments: string[];
    commandLines: CommandLine[];
    env: Record<string, string>;
};

export type StaleFile = {
    diff?: string;
    path: string;
    kind: 'changed' | 'absent' | 'stray';
};

export type CheckGeneration = {
    buildConfigs: (session: Session) => ConfigTargets;
    listStaleFiles: (session: Session, options: Pick<CheckRunOptions, 'verbose'>) => StaleFile[];
    listWrittenGlobs: (session: Session) => string[];
    writeStaleFiles: (session: Session) => Promise<string[]>;
};

export type CheckSession = Session & {
    generation: CheckGeneration;
    limitProcess: LimitFunction;
    selection?: RunSelection | undefined;
};
