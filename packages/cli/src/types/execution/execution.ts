// The types of execution in this package.
import type { z } from 'zod';
import type { ConfinedRoot } from '#cli/types/platform.ts';
import type { resolveCheck } from '#cli/execution/engines.ts';
import type { CheckResult, Finding } from '#cli/types/checks/checks.ts';
import type { packageManagerSchema } from '#cli/tools/packages/manager.ts';
import type { ToolContext, ToolInspection } from '#cli/types/tools/tools.ts';
import type { pushReportSchema, reportSchema } from '#cli/execution/report.ts';
import type { CheckSpec, Manifest, ToolPin } from '#cli/types/configurations.ts';
import type { Defined, IgnoreEntry, PolicyFiles, ScopeSelection } from '#cli/types/policy/policy.ts';
import type { Repository, SourceObservations, TrackedFile } from '#cli/types/repository/repository.ts';

/** What one tool run accumulates across its spawns. */
export type ToolRunState = { root: string; cwd: string; findings: Finding[]; isFailed: boolean };
export type RunReport = Defined<Omit<z.infer<typeof reportSchema>, 'checks' | 'ignores' | 'coverage'>> & {
    checks: CheckResult[];
    coverage: Omit<z.infer<typeof reportSchema.shape.coverage>, 'findings'> & { findings: Finding[] };
    ignores: Defined<z.infer<typeof reportSchema.shape.ignores.element>>[];
};
export type PushReport = Omit<z.infer<typeof pushReportSchema>, 'revisions'> & {
    revisions: (Omit<z.infer<typeof pushReportSchema.shape.revisions.element>, 'report'> & { report: RunReport })[];
};
export type Skip = PlannedCheck['skip'];
export type RuleSkip = {
    applies: (spec: CheckSpec, check: PlannedCheck, hasGit: boolean) => boolean;
    note: (spec: CheckSpec) => string;
};
export type CommandPart = string | { file: true };
export type Substitutions = {
    files: string[];
    scope: string;
    root: string;
    messageFile?: string;
    indent: number;
};
/** A tool command expanded and ready to spawn: once, or once per file. */
export type ToolInvocation = { argv: string[]; file?: string };
export type FixResult = { check: string; changed: string[] } & (
    | { status: 'changed' | 'unchanged' | 'skipped' }
    | { status: 'failed'; note: string }
);
export type FixReport = { results: FixResult[]; changed: string[]; diffs: string[] };
/** File observations shared by cached checks within one execution pass. */
export type RunHashes = {
    policy: string;
    files: Map<string, string>;
    tools: Map<string, string>;
};
export type ToolRun = {
    session: Session;
    planned: PlannedCheck;
    tool: ToolPin;
    command: string[];
    inspection: ToolInspection;
    base: CheckResult;
};
export type PreparedCommand = {
    root: string;
    cwd: string;
    argv: string[];
    commands: ToolInvocation[];
    env: Record<string, string>;
};
export type CoverageReport = {
    endings: { ending: string; scope: string; files: number; kinds: string[] }[];
    unchecked: { path: string; reason: string; remedy?: string }[];
    partial: { path: string; missing: string[] }[];
    checked: number;
};
export type Session = ToolContext & {
    observations: SourceObservations;
    /** Persistent result storage for a disposable revision snapshot. */
    cacheRoot?: string;
    resources?: DisposableStack;
    packageManager?: z.infer<typeof packageManagerSchema>;
    cancelSignal?: AbortSignal;
    version: string;
    policyFiles: PolicyFiles;
    manifests: Map<string, Manifest>;
    repository: Repository;
    scopes: ScopeSelection[];
};
export type CacheKeyInput = {
    check: string;
    scope: string;
    toolVersion: string;
    configurationHash: string;
    files: { path: string; hash: string }[];
    extra?: string;
};
export type Executable = { check: PlannedCheck; run: ReturnType<typeof resolveCheck> };
export type Pass = {
    session: Session;
    options: RunOptions;
    hashes: RunHashes;
    staged: Set<string> | undefined;
    uses: Map<string, IgnoreUse>;
};
export type RunOptions = RunReportOptions & {
    fix: boolean;
    noCache?: boolean;
    cancelSignal?: AbortSignal;
};
export type RunOutcome = { report: RunReport; planned: PlannedCheck[]; fixes?: FixReport };
export type IgnoreUse = { entry: IgnoreEntry; matched: number };
export type InlineIgnore = { line: number; check: string; reason?: string };
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
export type RunReportOptions = PlanOptions & {
    onResult?: (result: CheckResult) => void;
    isDryRun: boolean;
    comparison?: NonNullable<RunReport['comparison']>;
};
export type Copy = { source: string; target: string };
export type Scratch = {
    root: string;
    scratch: string;
    files: ConfinedRoot;
    copies: Map<string, string>;
    pending: Copy[];
    fileLinks: Copy[];
};
export type StageFilter = 'all' | 'commit' | 'push' | 'manual' | 'message';
export type PlanOptions = {
    commits?: string[];
    historyComplete?: boolean;
    stage: StageFilter;
    staged?: string[];
    changed?: string[];
    only?: string[];
    /** Root-relative paths selected by positional file and directory arguments. */
    paths?: string[];
    skips: string[];
    messageFile?: string;
};
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
/** One check to plan: its spec and the manifest it came from, none for a [[check]] entry. */
export type PlanEntry = { spec: CheckSpec; manifest?: Manifest };
/** What planning one scope needs. */
export type PlanContext = {
    session: Session;
    scope: ScopeSelection;
    options: PlanOptions;
    platform: string;
    narrow: Set<string> | undefined;
    children: string[];
};
