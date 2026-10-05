import type { z } from 'zod';
import type { Drift } from '#cli/types/lifecycle/output.ts';
import type { Defined } from '#cli/types/platform/runtime.ts';
import type { ReadCache } from '#cli/types/platform/reads.ts';
import type { ToolSearch } from '#cli/types/tools/install.ts';
import type { Session } from '#cli/types/execution/session.ts';
import type { Stage, PlanOptions } from '#cli/types/execution/planning.ts';
import type { ToolPin, Manifest, CheckSpec } from '#cli/types/configurations.ts';
import type { resultSchema, findingSchema } from '#cli/parsers/schema/report.ts';
import type { Repository, ScopeEntry, TrackedFile } from '#cli/types/repository/inventory.ts';
import type { ScopeView, PolicyFile, IgnoreEntry, ScopeSelection } from '#cli/types/policy/settings.ts';

export type SuppressionComment = { file: string; line: number; form: string; reason?: string; forbidden: boolean };

/** The checks gspot runs itself, by check ID: the engines of the configuration analyses and the runners that drive a tool. */
export type CheckRegistry = Record<string, { engine: Engine } | { run: Executable['run'] }>;

export type FixResult = { check: string; changed: string[] } & (
    | { status: 'changed' | 'unchanged' | 'skipped' }
    | { status: 'failed'; note: string }
);

export type FixReport = { results: FixResult[]; changed: string[]; diffs: string[] };

export type PlannedCheck = {
    commits?: string[];
    scope: ScopeSelection;
    spec: CheckSpec;
    manifest?: Manifest;
    files: TrackedFile[];
    tool?: ToolPin;
    skip?: { cause: RunReport['skips'][number]['cause']; note: string };
    /** Changed paths absent from the readable tree that still trigger a project check. */
    triggerPaths: string[];
    messageFile?: string;
};

export type RunReportOptions = PlanOptions & {
    stage: StageFilter;
    onResult?: (result: CheckResult) => void;
    isDryRun: boolean;
    comparison?: NonNullable<RunReport['comparison']>;
    /** Working-tree changes omitted when this run reads staged content. */
    unstagedChanges?: number;
};

export type Executable = {
    check: PlannedCheck;
    run: (session: Session, planned: PlannedCheck, options?: CheckRunOptions) => Promise<CheckResult>;
};

/** Selected staged paths and optional command or workspace supplied by a check. */
export type CheckRunOptions = { staged?: Set<string>; command?: string[]; workspace?: string };

export type Pass = {
    session: Session;
    options: RunOptions;
    staged: Set<string> | undefined;
    uses: Map<IgnoreEntry, IgnoreUse>;
};

export type RunOptions = RunReportOptions & {
    checks: CheckRegistry;
    fix: boolean;
    cancelSignal?: AbortSignal;
};

export type RunOutcome = { report: RunReport; planned: PlannedCheck[]; fixes?: FixReport };

export type IgnoreUse = { entry: IgnoreEntry; matched: number };

export type EngineOutcome = { findings: Finding[]; files: string[] };

export type Engine = (input: EngineInput) => Finding[] | EngineOutcome | Promise<Finding[] | EngineOutcome>;

export type EngineInput = {
    installedRoot?: string;
    policyFiles: PolicyFile;
    selection: ScopeSelection;
    manifests: Map<string, Manifest>;
    inspections: ToolSearch['inspections'];
    scopeEntries: ScopeEntry[];
    attributes: Repository['attributes'];
    hasGit: boolean;
    reads: ReadCache;
    resources?: DisposableStack;
    cancelSignal?: AbortSignal;
    scopeRoot: string;
    repositoryFiles?: TrackedFile[];
    generatedDrift?: () => Drift[];
    /** Every scope's selection, for a check that runs once. */
    selections?: ScopeSelection[];
    root: string;
    scope: string;
    view: ScopeView;
    spec: CheckSpec;
    files: TrackedFile[];
    staged?: Set<string>;
};

/** A result status validated by the execution report schema. */
export type CheckStatus = z.output<typeof resultSchema>['status'];

export type CheckResult = Defined<Omit<z.infer<typeof resultSchema>, 'findings'>> & {
    findings: Finding[];
};

/** The run report as check --json prints it. */
export type RunReport = {
    comparison?: { content: 'working-tree' | 'index' | 'commit'; reference: string };
    version: string;
    stage: StageFilter;
    started: string;
    duration: number;
    checks: CheckResult[];
    ignores: { check: string; rule?: string; paths?: string[]; reason?: string; matched: number }[];
    skips: {
        check: string;
        cause: 'level' | 'flag' | 'platform' | 'replaced' | 'setting' | 'condition' | 'ignore' | 'inputs';
    }[];
    /** How many changed files the run left out: the unstaged ones when it read the index. */
    unstagedChanges: number;
    /** Whether the run read only part of the repository: the staged files, a change set, or named paths. */
    partial: boolean;
    /** The checks that failed, with the checks whose fixer failed although the check passed. */
    failed: string[];
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

export type Finding = Defined<z.infer<typeof findingSchema>>;

/** Where a finding points: the file, and the line and column when the check knows them. */
export type FindingPlace = Pick<Finding, 'file' | 'line' | 'column'>;

export type StageFilter = Stage | 'all';

/** Checks and fixer outcomes prepared for the subsequent execution pass. */
export type ReplannedFixResult = { executables: Executable[]; fixes: FixReport | undefined };

/** Findings retained after policy ignores and the matches credited to their authored entries. */
export type IgnoredFindings = { kept: Finding[]; uses: IgnoreUse[] };

/** A preview fixes a disposable copy and reports differences. */
export type FixOptions = { isDryRun: boolean };

/** A process failure that prevents check output from being interpreted. */
export type ExecutionFailure = { status: 'error' | 'missing'; note: string };
