import type { LimitFunction } from 'p-limit';
import type { Check } from '#cli/types/manifests.ts';
import type { IgnoreRecord } from '#cli/types/settings.ts';
import type { Session, LintRuleDocs } from '#cli/types/tools.ts';
import type { Finding, CommandLine, CheckFinding, ConfigTargets } from '#cli/types/engine/tool-runs.ts';
import type { SkipCause, PlanOptions, StageFilter, RunSelection, PlannedCheck } from '#cli/types/engine/plan.ts';

export type FinishedRun = {
    session: Session;
    options: RunOptions;
    comparison: RunReport['comparison'];
    started: Date;
    planned: PlannedCheck[];
    active: PlannedCheck[];
    results: CheckResult[];
    fixes: FixReport | undefined;
    baselined: RunReport['baselined'];
};

export type PathBytes = Map<string, Buffer | undefined>;

export type FixRounds = { results: FixResult[]; before: PathBytes; after: PathBytes };

export type PushInput = { stdin: string; remote?: string };

export type FixReport = { results: FixResult[]; changed: string[]; broken: string[]; conflicted: string[] };

export type FixResult = { check: string; changed: string[] } & (
    { status: 'changed' | 'unchanged' | 'skipped' } | { status: 'failed' | 'canceled'; note: string }
);

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
    baselineRun: BaselineRun;
    baselined: Record<string, number>;
    progress: { finished: number; total: number; unfinished: Set<PlannedCheck> };
};

type BaselineRun = {
    unused: Map<string, BaselineCount[]>;
    finished: PlannedCheck[];
    paths: string[] | undefined;
};

export type BaselineCount = { file: string; check: string; rule: string; count: number };

export type RunOptions = PlanOptions & {
    generation: CheckGeneration;
    selectCheckCode: (check: Check) => CheckCode | undefined;
    baseline?: BaselineCount[] | undefined;
    started?: Date | undefined;
    stage: StageFilter;
    onProgress?: ((progress: CheckProgress) => void) | undefined;
    cwd: string;
    pathArguments: string[];
    fix: boolean;
    verbose?: boolean | undefined;
};

export type RunReport = {
    notes: string[];
    comparison?: { content: 'working-tree' | 'index' | 'commit'; reference: string };
    version: string;
    stages: ReadonlyArray<Check['stage']>;
    started: string;
    duration: number;
    checks: readonly CheckResult[];
    skippedCount: Readonly<Partial<Record<NonNullable<CheckResult['cause']>, number>>>;
    ignores: readonly IgnoreRecord[];
    baselined: Readonly<Record<string, number>>;
    unstagedChanges: number;
    partial: boolean;
    failed: readonly string[];
    exitCode: number;
};

export type RunResult = { report: RunReport; planned: PlannedCheck[]; setup: number; fixes?: FixReport };

export type CheckStatus = 'passed' | 'failed' | 'missing' | 'skipped' | 'error';

export type CheckCode = ({ check: BuiltInCheck; run?: never } | { run?: CheckRun; check?: never }) & {
    ruleDocs?: Readonly<Record<string, LintRuleDocs>>;
    runsLast?: boolean;
};

type CheckRun = (
    session: CheckSession,
    planned: PlannedCheck,
    options?: CheckRunOptions,
) => CheckResult | Promise<CheckResult>;

export type CheckRunOptions = {
    verbose?: boolean | undefined;
    command?: string[];
    baselineRun: BaselineRun;
};

export type BuiltInCheckResult = { findings: CheckFinding[]; files: string[]; notes?: string[] };

export type BuiltInCheck = (
    session: CheckSession,
    planned: PlannedCheck,
    options: CheckRunOptions,
) => CheckFinding[] | BuiltInCheckResult | Promise<CheckFinding[] | BuiltInCheckResult>;

export type CheckResult = {
    check: string;
    scope: string;
    status: CheckStatus;
    fileCount: number;
    files?: readonly string[];
    duration: number;
    span?: { start: number; end: number };
    findings: readonly Finding[];
    help?: string;
    note?: string;
    reportNotes?: readonly string[];
    stack?: string;
    cause?: SkipCause | 'no-files';
    fixCommand?: string;
    rerun?: string;
    command?: readonly string[];
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
    listWrittenPaths: (session: Session) => string[];
};

export type CheckSession = Session & {
    generation: CheckGeneration;
    limitProcess: LimitFunction;
    selection?: RunSelection | undefined;
};
