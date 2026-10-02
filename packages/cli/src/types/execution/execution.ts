// The types of execution in this package.
import type { z } from 'zod';
import type { ToolInvocation } from '#cli/types/execution/tool.ts';
import type { DriftEntry } from '#cli/types/lifecycle/lifecycle.ts';
import type { PlanOptions } from '#cli/types/execution/planning.ts';
import type { Session, ToolSearch } from '#cli/types/tools/tools.ts';
import type { ToolPin, Manifest, CheckSpec } from '#cli/types/kits.ts';
import type { Defined, SourceReads } from '#cli/types/platform/platform.ts';
import type { findingSchema, checkResultSchema } from '#cli/execution/finding.ts';
import type { Repository, ScopeEntry, TrackedFile } from '#cli/types/repository/repository.ts';
import type { MergedView, IgnoreEntry, PolicyFiles, ScopeSelection } from '#cli/types/policy/policy.ts';

type RunReportOptions = PlanOptions & {
    onResult?: (result: CheckResult) => void;
    isDryRun: boolean;
    comparison?: NonNullable<RunReport['comparison']>;
};

export type SuppressionComment = { file: string; line: number; form: string; reason?: string; forbidden: boolean };

export type EngineOutcome = { findings: Finding[]; checkedFiles: string[] };
export type Engine = (input: EngineInput) => Finding[] | EngineOutcome | Promise<Finding[] | EngineOutcome>;

export type Finding = Defined<z.infer<typeof findingSchema>>;
export type CheckResult = Defined<Omit<z.infer<typeof checkResultSchema>, 'findings'>> & {
    findings: Finding[];
};

/** Where a finding points: the file, and the line and column when the check knows them. */
export type FindingPlace = Pick<Finding, 'file' | 'line' | 'column'>;

/** The run report as check --json prints it. */
export type RunReport = {
    comparison?: { content: 'working-tree' | 'index' | 'commit'; reference: string };
    version: string;
    stage: string;
    started: string;
    duration: number;
    checks: CheckResult[];
    ignores: { check: string; rule?: string; paths?: string[]; reason?: string; matched: number }[];
    skips: { check: string; source: 'flag' | 'platform' | 'rules' | 'ignore' }[];
    unstaged: number;
    narrowed: boolean;
    failed: string[];
    exitCode: number;
};

export type FixResult = { check: string; changed: string[] } & (
    | { status: 'changed' | 'unchanged' | 'skipped' }
    | { status: 'failed'; note: string }
);
export type FixReport = { results: FixResult[]; changed: string[]; diffs: string[] };

export type PreparedCommand = {
    root: string;
    cwd: string;
    argv: string[];
    commands: ToolInvocation[];
    env: Record<string, string>;
};

export type Executable = {
    check: PlannedCheck;
    run: (session: Session, planned: PlannedCheck, staged?: Set<string>) => Promise<CheckResult>;
};
export type Pass = {
    session: Session;
    options: RunOptions;
    staged: Set<string> | undefined;
    uses: Map<string, IgnoreUse>;
};
/** The checks gspot runs itself, by check ID: the engines of the kit analyses and the runners that drive a tool. */
export type CheckRegistry = { engines: Record<string, Engine>; runners: Record<string, Executable['run']> };

export type RunOptions = RunReportOptions & {
    checks: CheckRegistry;
    fix: boolean;
    cancelSignal?: AbortSignal;
};
export type RunOutcome = { report: RunReport; planned: PlannedCheck[]; fixes?: FixReport };
export type IgnoreUse = { entry: IgnoreEntry; matched: number };
export type ReportInput = {
    session: Session;
    options: RunReportOptions;
    started: Date;
    planned: PlannedCheck[];
    active: PlannedCheck[];
    ran: CheckResult[];
    uses: Map<string, IgnoreUse>;
    fixes: FixReport | undefined;
};

export type StageFilter = 'all' | 'commit' | 'push' | 'manual' | 'message';

export type PlannedCheck = {
    commits?: string[];
    check: string;
    scope: ScopeSelection;
    spec: CheckSpec;
    manifest?: Manifest;
    files: TrackedFile[];
    tool?: ToolPin;
    skip?: { source: RunReport['skips'][number]['source']; note: string };
    projectWide: boolean;
    /** Changed paths absent from the readable tree that still trigger a project check. */
    triggerPaths: string[];
    messageFile?: string;
};

export type EngineInput = {
    policyFiles: PolicyFiles;
    selection: ScopeSelection;
    manifests: Map<string, Manifest>;
    inspections: ToolSearch['inspections'];
    scopeEntries: ScopeEntry[];
    attributes: Repository['attributes'];
    hasGit: boolean;
    reads: SourceReads;
    resources?: DisposableStack;
    cancelSignal?: AbortSignal;
    scopeRoot: string;
    repositoryFiles?: TrackedFile[];
    generatedDrift?: () => DriftEntry[];
    /** Every scope's selection, for a check that runs once. */
    selections?: ScopeSelection[];
    root: string;
    scope: string;
    view: MergedView;
    spec: CheckSpec;
    files: TrackedFile[];
    staged?: Set<string>;
};
