import type { z } from 'zod';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { Defined } from '#cli/types/platform/runtime.ts';
import type { ReadCache } from '#cli/types/platform/reads.ts';
import type { ToolSearch } from '#cli/types/tools/install.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import type { resultSchema } from '#cli/parsers/schema/contracts.ts';
import type { Manifest, CheckDeclaration } from '#cli/types/configurations.ts';
import type { PlanOptions, StageFilter, PlannedCheck } from '#cli/types/planning.ts';
import type { Repository, ScopeEntry, TrackedFile } from '#cli/types/repository/inventory.ts';
import type { ScopeView, PolicyFile, IgnoreEntry, ScopeSelection } from '#cli/types/policy/settings.ts';

export type SuppressionComment = {
    file: string;
    line: number;
    form: string;
    reasonForm: string;
    reason?: string;
    forbidden: boolean;
};

/** Native input implementations or session callbacks, keyed by the declared check ID. */
export type BuiltInChecks = Record<
    string,
    ({ input: BuiltInCheck } | { run: Executable['run'] }) & { fix?: BuiltInFix }
>;

/** A native correction publishes through the same repository or disposable-copy boundary as command fixes. */
export type BuiltInFix = (planned: PlannedCheck, root: string) => FixResult | Promise<FixResult>;

export type FixResult = { check: string; changed: string[] } & (
    | { status: 'changed' | 'unchanged' | 'skipped' }
    | { status: 'failed'; note: string }
);

/** Pre-fix bytes of changed files, retained only for isolated publication checks. */
export type FixRun = { result: FixResult; originals: Map<string, Buffer | undefined> };

export type FixReport = { results: FixResult[]; changed: string[]; diffs: string[] };

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
    run: (session: ToolSession, planned: PlannedCheck, options?: CheckRunOptions) => Promise<CheckResult>;
};

/** Selected staged paths and optional command or workspace supplied by a check. */
export type CheckRunOptions = { staged?: Set<string>; command?: string[]; workspace?: string };

export type Pass = {
    session: ToolSession;
    options: RunOptions;
    staged: Set<string> | undefined;
    uses: Map<IgnoreEntry, IgnoreUse>;
};

export type RunOptions = RunReportOptions & {
    checks: BuiltInChecks;
    fix: boolean;
    cancelSignal?: AbortSignal;
};

export type RunOutcome = { report: RunReport; planned: PlannedCheck[]; fixes?: FixReport };

export type IgnoreUse = { entry: IgnoreEntry; matched: number };

export type CheckOutcome = { findings: Finding[]; files: string[] };

export type BuiltInCheck = (input: CheckInput) => Finding[] | CheckOutcome | Promise<Finding[] | CheckOutcome>;

export type CheckInput = {
    /** Inventory-owned source paths of this project's declared workspace dependencies. */
    dependencyFiles: () => string[];
    index: Repository['index'];
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
    /** Every effective scope selection supplied by the open session. */
    selections: ScopeSelection[];
    root: string;
    scope: string;
    view: ScopeView;
    check: CheckDeclaration;
    /** Planner-selected files; scope checks exclude every nested scope. */
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
        cause: NonNullable<PlannedCheck['skip']>['cause'];
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
    session: ToolSession;
    options: RunReportOptions;
    started: Date;
    planned: PlannedCheck[];
    active: PlannedCheck[];
    ran: CheckResult[];
    uses: Map<IgnoreEntry, IgnoreUse>;
    fixes: FixReport | undefined;
};

/** Checks and fixer outcomes prepared for the subsequent execution pass. */
export type ReplannedFixResult = { executables: Executable[]; fixes: FixReport | undefined };

/** Findings retained after policy ignores and the matches credited to their authored entries. */
export type IgnoredFindings = { kept: Finding[]; uses: IgnoreUse[] };

/** A preview fixes a disposable copy and reports differences. */
export type FixOptions = { isDryRun: boolean; checks: BuiltInChecks };
