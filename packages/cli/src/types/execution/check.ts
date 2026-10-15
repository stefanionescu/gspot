import type { ToolSearch } from '#cli/types/tools/find.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import type { IgnoreEntry } from '#cli/types/settings/file.ts';
import type { CHECK_STATUSES } from '#cli/config/execution/run.ts';
import type { PushInput } from '#cli/types/repository/revisions.ts';
import type { Manifest, CheckDeclaration } from '#cli/types/configurations.ts';
import type { SettingsFile, ScopeSelection } from '#cli/types/settings/values.ts';
import type { Session, PlanOptions, StageFilter, PlannedCheck } from '#cli/types/planning.ts';
import type { Repository, ScopeEntry, TrackedFile } from '#cli/types/repository/inventory.ts';

/** A built-in fix publishes through the same repository or disposable-copy boundary as command fixes. */
type BuiltInFix = (planned: PlannedCheck, root: string) => FixResult | Promise<FixResult>;

type RunReportOptions = PlanOptions & {
    stage: StageFilter;
    onResult?: (result: CheckResult) => void;
    isDryRun: boolean;
    comparison?: NonNullable<RunReport['comparison']>;
    /** Working-tree changes omitted when this run reads staged content. */
    unstagedChanges?: number;
};

/** The completion status of a check. */
type CheckStatus = (typeof CHECK_STATUSES)[number];

/** Execution callbacks, keyed by the declared check ID. */
export type BuiltInChecks = Record<
    string,
    { run: RunnableCheck['run']; fix?: BuiltInFix } & Pick<CheckRunOptions, 'arguments' | 'configurationFiles'>
>;

export type FixResult = { check: string; changed: string[] } & (
    | { status: 'changed' | 'unchanged' | 'skipped' }
    | { status: 'failed'; note: string }
);

/** Pre-fix bytes of changed files, retained only for isolated publication checks. */

export type FixReport = { results: FixResult[]; changed: string[]; diffs: string[] };

export type RunnableCheck = {
    check: PlannedCheck;
    arguments?: CheckRunOptions['arguments'];
    configurationFiles?: CheckRunOptions['configurationFiles'];
    run: (session: Session, planned: PlannedCheck, options?: CheckRunOptions) => Promise<CheckResult>;
};

/** Selected staged paths and optional command or scratch root supplied by a check. */
export type CheckRunOptions = {
    staged?: Set<string>;
    command?: string[];
    scratchRoot?: string;
    arguments?: ((input: CheckInput) => string[]) | undefined;
    configurationFiles?: ((input: CheckInput) => string[]) | undefined;
};

export type RunState = {
    session: Session;
    options: RunOptions;
    staged: Set<string> | undefined;
    uses: Map<IgnoreEntry, IgnoreUse>;
};

export type RunOptions = RunReportOptions & {
    push?: PushInput | undefined;
    checks: BuiltInChecks;
    fix: boolean;
    cancelSignal?: AbortSignal;
};

export type RunOutcome = { report: RunReport; planned: PlannedCheck[]; fixes?: FixReport };

export type IgnoreUse = { entry: IgnoreEntry; matched: number };

export type CheckOutcome = { findings: Finding[]; files: string[] };

export type BuiltInCheck = (input: CheckInput) => Finding[] | CheckOutcome | Promise<Finding[] | CheckOutcome>;

export type CheckInput = {
    generatedPaths: () => ReadonlySet<string>;
    timeoutSeconds: number;
    /** Inventory-owned source paths of this project's declared workspace dependencies. */
    dependencyFiles: () => string[];
    index: Repository['index'];
    installedRoot?: string;
    settingsFile: SettingsFile;
    selection: ScopeSelection;
    manifests: Map<string, Manifest>;
    inspections: ToolSearch['inspections'];
    miseBinPaths?: string[];
    scopeEntries: ScopeEntry[];
    attributes: Repository['attributes'];
    hasGit: boolean;
    reads: ReadCache;
    resources: DisposableStack;
    cancelSignal?: AbortSignal;
    repositoryFiles: TrackedFile[];
    /** Every effective scope selection supplied by the open session. */
    selections: ScopeSelection[];
    root: string;
    check: CheckDeclaration;
    /** Planner-selected files; scope checks exclude every nested scope. */
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
    uses: Map<IgnoreEntry, IgnoreUse>;
    fixes: FixReport | undefined;
};

/** Checks and fixer outcomes prepared for the subsequent execution pass. */
export type ReplannedFixResult = { executables: RunnableCheck[]; fixes: FixReport | undefined };

/** Findings retained after settings ignores and the matches credited to their written entries. */

/** A preview fixes a disposable copy and reports differences. */
export type FixOptions = { isDryRun: boolean; checks: BuiltInChecks };

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
