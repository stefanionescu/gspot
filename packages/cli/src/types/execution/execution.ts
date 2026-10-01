// The types of execution in this package.
import type { z } from 'zod';
import type { Root } from '#cli/types/platform.ts';
import type { Finding, CheckResult } from '#cli/types/checks.ts';
import type { ToolPin, Manifest, CheckSpec } from '#cli/types/kits.ts';
import type { packageToolSchema } from '#cli/tools/packages/identity.ts';
import type { ToolSearch, ToolInspection } from '#cli/types/tools/tools.ts';
import type { IgnoreEntry, PolicyFiles, ScopeSelection } from '#cli/types/policy/policy.ts';
import type { Repository, SourceReads, TrackedFile } from '#cli/types/repository/repository.ts';

/** What one tool run accumulates across its spawns. */
export type ToolRunState = { root: string; cwd: string; findings: Finding[]; isFailed: boolean };
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
    /** Source files analyzed by checks that ran, supported files no enabled check reads, and coverage findings. */
    coverage: { checked: number; unchecked: number; findings: Finding[] };
    unstaged: number;
    narrowed: boolean;
    failed: string[];
    exitCode: number;
};
/** The push report: one run report for every distinct tree that Git's pre-push input names. */
export type PushReport = {
    canceled?: { pendingRefs: string[] };
    revisions: { object: string; refs: string[]; commits: string[]; historyComplete: boolean; report: RunReport }[];
    notApplicable: { ref: string; object: string; reason: 'deleted ref' | 'non-commit object' }[];
    exitCode: number;
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
export type Session = ToolSearch & {
    reads: SourceReads;
    resources?: DisposableStack;
    packageClient?: z.infer<typeof packageToolSchema>;
    cancelSignal?: AbortSignal;
    version: string;
    policyFiles: PolicyFiles;
    manifests: Map<string, Manifest>;
    repository: Repository;
    scopes: ScopeSelection[];
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
export type RunOptions = RunReportOptions & {
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
export type RunReportOptions = PlanOptions & {
    onResult?: (result: CheckResult) => void;
    isDryRun: boolean;
    comparison?: NonNullable<RunReport['comparison']>;
};
export type Copy = { source: string; target: string };
export type Scratch = {
    root: string;
    scratch: string;
    files: Root;
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
export type PlanInputs = {
    session: Session;
    scope: ScopeSelection;
    options: PlanOptions;
    platform: string;
    narrow: Set<string> | undefined;
    children: string[];
};
/** The platform name and architecture a run is on. */
export type Host = { platform: string; arch: string };
