import type { ToolSearch } from '#cli/types/tools/find.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import type { IgnoreRecord } from '#cli/types/settings/file.ts';
import type { CHECK_STATUSES } from '#cli/config/checks/run/run.ts';
import type { PushInput } from '#cli/types/repository/revisions.ts';
import type { ToolFileGeneration } from '#cli/types/generation/files.ts';
import type { Manifest, CheckDeclaration } from '#cli/types/configurations.ts';
import type { SettingsFile, ScopeSelection } from '#cli/types/settings/values.ts';
import type { Scope, Repository, TrackedFile } from '#cli/types/repository/inventory.ts';
import type { Session, PlanOptions, StageFilter, PlannedCheck } from '#cli/types/planning.ts';

/** A built-in fix writes through the same repository or scratch copy boundary as command fixes. */
type BuiltInFix = (planned: PlannedCheck, root: string) => FixResult | Promise<FixResult>;

type RunReportOptions = PlanOptions & {
    stage: StageFilter;
    onResult?: (result: CheckResult, progress: CheckProgress) => void;
    isDryRun: boolean;
    comparison?: NonNullable<RunReport['comparison']>;
    /** Working-tree changes omitted when this run reads staged content. */
    unstagedChanges?: number;
};

/** The completion status of a check. */
type CheckStatus = (typeof CHECK_STATUSES)[number];

/** Execution callbacks, keyed by the declared check ID. */
export type CheckImplementations = Record<
    string,
    ({ check: BuiltInCheck; run?: never } | { run: RunnableCheck['run']; check?: never }) & { fix?: BuiltInFix } & Pick<
            CheckRunOptions,
            'arguments' | 'toolFiles'
        >
>;

export type FixResult = { check: string; changed: string[] } & (
    | { status: 'changed' | 'unchanged' | 'skipped' }
    | { status: 'failed'; note: string }
);

export type FixReport = { results: FixResult[]; changed: string[]; diffs: string[] };

export type RunnableCheck = {
    check: PlannedCheck;
    arguments?: CheckRunOptions['arguments'];
    toolFiles?: CheckRunOptions['toolFiles'];
    run: (session: Session, planned: PlannedCheck, options?: CheckRunOptions) => CheckResult | Promise<CheckResult>;
};

/** The staged paths, and the command or scratch root that a check gives. */
export type CheckRunOptions = {
    staged?: Set<string>;
    command?: string[];
    scratchRoot?: string;
    arguments?: ((input: CheckInput) => string[]) | undefined;
    toolFiles?: ((input: CheckInput) => string[]) | undefined;
};

export type RunState = {
    session: Session;
    options: RunOptions;
    staged: Set<string> | undefined;
    uses: Map<IgnoreRecord, IgnoreUse>;
};

export type RunOptions = RunReportOptions & {
    push?: PushInput | undefined;
    fix: boolean;
    cancelSignal?: AbortSignal;
};

export type RunResult = { report: RunReport; planned: PlannedCheck[]; fixes?: FixReport };

export type IgnoreUse = { entry: IgnoreRecord; matched: number };

export type BuiltInCheckResult = { findings: Finding[]; files: string[] };

export type BuiltInCheck = (
    input: CheckInput,
) => Finding[] | BuiltInCheckResult | Promise<Finding[] | BuiltInCheckResult>;

export type CheckInput = {
    toolFiles: () => ToolFileGeneration;
    generatedPaths: () => ReadonlySet<string>;
    timeoutSeconds: number;
    /** Inventory-owned source paths of this project's declared workspace dependencies. */
    dependencyFiles: () => string[];
    index: Repository['index'];
    installedRoot: string;
    settingsFile: SettingsFile;
    scope: ScopeSelection;
    manifests: Map<string, Manifest>;
    inspections: ToolSearch['inspections'];
    miseBinPaths: string[];
    scopes: Scope[];
    attributes: Repository['attributes'];
    hasGit: boolean;
    reads: ReadCache;
    resources: DisposableStack;
    cancelSignal?: AbortSignal;
    repositoryFiles: TrackedFile[];
    /** Every scope selection of the session. */
    selections: ScopeSelection[];
    root: string;
    check: CheckDeclaration;
    /** The files that planning chose; scope checks leave out every nested scope. */
    files: TrackedFile[];
    staged?: Set<string>;
};

export type CheckResult = {
    check: string;
    scope: string;
    status: CheckStatus;
    fileCount: number;
    files?: readonly string[];
    duration: number;
    findings: readonly Finding[];
    note?: string;
    reproduce?: string;
    command?: readonly string[];
};

/** The run report as check --json prints it. */
export type RunReport = {
    comparison?: { content: 'working-tree' | 'index' | 'commit'; reference: string };
    version: string;
    stage: StageFilter;
    started: string;
    duration: number;
    checks: readonly CheckResult[];
    ignores: readonly { check: string; rule?: string; paths?: readonly string[]; reason?: string; matched: number }[];
    skips: readonly {
        check: string;
        cause: NonNullable<PlannedCheck['skip']>['cause'];
    }[];
    /** How many changed files the run left out: the unstaged ones when it read the index. */
    unstagedChanges: number;
    /** Whether the run read only part of the repository: the staged files, a change set, or named paths. */
    partial: boolean;
    /** The checks that failed, with the checks whose fixer failed although the check passed. */
    failed: readonly string[];
    exitCode: number;
};

export type ReportInput = {
    session: Session;
    options: RunReportOptions;
    started: Date;
    planned: PlannedCheck[];
    active: PlannedCheck[];
    ran: CheckResult[];
    uses: Map<IgnoreRecord, IgnoreUse>;
    fixes: FixReport | undefined;
};

/** The checks and fixer results for the run after the fixes. */
export type PlanAfterFixes = { executables: RunnableCheck[]; fixes: FixReport | undefined };

/** A preview fixes a scratch copy and reports differences. */
export type FixOptions = { isDryRun: boolean };

export type ReproduceOptions = {
    push?: PushInput;
    messageFile?: string;
    staged?: boolean;
};

export type Finding = {
    check: string;
    file: string;
    message: string;
    fixable: boolean;
    line?: number | undefined;
    column?: number;
    rule?: string;
    help?: string;
};

/** Where a finding points: the file, and the line and column when the check knows them. */
export type FindingPlace = Pick<Finding, 'file' | 'line' | 'column'>;

/** The finished check count and the comparison, for terminal progress. */
export type CheckProgress = { completed: number; total: number; comparison: RunReport['comparison'] };
