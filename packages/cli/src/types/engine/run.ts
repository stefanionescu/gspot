import type { LimitFunction } from 'p-limit';
import type { Check } from '#cli/types/manifests.ts';
import type { IgnoreRecord } from '#cli/types/settings.ts';
import type { Session, LintRuleDocs } from '#cli/types/tools.ts';
import type { SkipCause, PlanOptions, StageFilter, PlannedCheck } from '#cli/types/engine/plan.ts';
import type { Finding, CommandLine, CheckFinding, ConfigTargets } from '#cli/types/engine/tool-runs.ts';

export type FinishedRun = {
    session: Session;
    options: RunOptions;
    started: Date;
    planned: PlannedCheck[];
    active: PlannedCheck[];
    results: CheckResult[];
    fixes: FixReport | undefined;
    baselined: RunReport['baselined'];
};

export type ReproduceOptions = {
    paths: string[];
    changed: string | undefined;
    messageFile: string | undefined;
    staged: boolean;
};

export type PathBytes = Map<string, Buffer | undefined>;

export type FixRounds = { results: FixResult[]; before: PathBytes; after: PathBytes };

export type PushInput = { stdin: string; remote?: string };

export type FixReport = { results: FixResult[]; changed: string[]; broken: string[]; conflicted: string[] };

export type FixResult = { check: string; changed: string[] } & (
    | { status: 'changed' | 'unchanged' | 'skipped' }
    | { status: 'failed' | 'canceled'; note: string }
);

export type CheckProgress = Pick<CheckResult, 'check' | 'scope' | 'duration'> & {
    finished: number;
    total: number;
    comparison: RunReport['comparison'];
};

export type PlanAfterFixes = { session: CheckSession; planned: PlannedCheck[]; fixes: FixReport | undefined };

export type Run = {
    session: CheckSession;
    options: RunOptions;
    codes: Map<PlannedCheck, CheckCode | undefined>;
    baselineRun: BaselineRun;
    baselined: Record<string, number>;
    progress: Pick<CheckProgress, 'finished' | 'total'>;
};

export type BaselineRun = {
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
    comparison?: NonNullable<RunReport['comparison']> | undefined;
    unstagedChanges?: number | undefined;
    cwd: string;
    pathArguments: string[];
    fix: boolean;
    verbose?: boolean | undefined;
};

export type RunReport = {
    notChecked?: { configuration: string; evidence: string }[];
    notes: string[];
    comparison?: { content: 'working-tree' | 'index' | 'commit'; reference: string };
    version: string;
    stages: readonly Check['stage'][];
    started: string;
    duration: number;
    checks: readonly CheckResult[];
    ignores: readonly IgnoreRecord[];
    baselined: Readonly<Record<string, number>>;
    unstagedChanges: number;
    partial: boolean;
    failed: readonly string[];
    exitCode: number;
};

export type RunResult = { report: RunReport; planned: PlannedCheck[]; fixes?: FixReport };

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
    baselineRun?: BaselineRun | undefined;
};

export type FindingOptions = { verbose: boolean; help: string | undefined };

export type BuiltInCheckResult = { findings: CheckFinding[]; files: string[] };

export type BuiltInCheck = (
    session: CheckSession,
    planned: PlannedCheck,
    options?: CheckRunOptions,
) => CheckFinding[] | BuiltInCheckResult | Promise<CheckFinding[] | BuiltInCheckResult>;

export type CheckResult = {
    check: string;
    scope: string;
    status: CheckStatus;
    fileCount: number;
    files?: readonly string[];
    duration: number;
    findings: readonly Finding[];
    help?: string;
    note?: string;
    stack?: string;
    cause?: SkipCause | 'no-files';
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

export type OutdatedFile = {
    diff?: string;
    path: string;
    kind: 'changed' | 'absent' | 'stray';
};

export type CheckGeneration = {
    buildConfigs: (session: Session) => ConfigTargets;
    listOutdatedFiles: (session: Session, options: Pick<CheckRunOptions, 'verbose'>) => OutdatedFile[];
};

export type CheckSession = Session & {
    generation: CheckGeneration;
    limitProcess: LimitFunction;
};
