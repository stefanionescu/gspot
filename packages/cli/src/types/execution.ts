import type { CheckResult, Finding, RunReport } from '#cli/types/reports.ts';
import type { Repository, ScopeEntry, TrackedFile } from '#cli/types/repository.ts';
import type { ToolContext } from '#cli/types/tools.ts';
// Type aliases of the run modules.
import type { CheckSpec, Manifest, ToolPin } from '#cli/types/configurations.ts';
import type { ExposedSettings, IgnoreEntry, MergedView, PolicyFiles } from '#cli/types/policy.ts';

export type CacheKeyInput = {
    check: string;
    scope: string;
    toolVersion: string;
    configurationHash: string;
    files: { path: string; hash: string }[];
    extra?: string;
};

export type CheckOptions = {
    onResult?: (result: CheckResult) => void;
    cwd: string;
    only?: string[];
    paths: string[];
    staged: boolean;
    push?: { input: string; remote?: string };
    changed?: string;
    fix: boolean;
    isDryRun: boolean;
    stage?: StageFilter;
    skips: string[];
    messageFile?: string;
    quiet: boolean;
    verbose: boolean;
    noCache: boolean;
};

export type CommandResult = { text: string; json: unknown; exitCode: number };

export type CheckCommandResult = CommandResult & { report?: RunReport };

export type EngineInput = {
    policyFiles: PolicyFiles;
    selection: ScopeSelection;
    manifests: Map<string, Manifest>;
    probes: ToolContext['probes'];
    scopeEntries: ScopeEntry[];
    attributes: Repository['attributes'];
    hasGit: boolean;
    runKey: object;
    resources?: DisposableStack;
    cancelSignal?: AbortSignal;
    scopeRoot: string;
    repositoryFiles?: TrackedFile[];
    generatedDrift?: () => import('#cli/types/generation.ts').DriftEntry[];
    suppressions?: import('#cli/checks/repository/suppressions.ts').SuppressionComment[];
    root: string;
    scope: string;
    view: MergedView;
    spec: CheckSpec;
    files: TrackedFile[];
    staged?: Set<string>;
};

export type EngineOutcome = { findings: Finding[]; checkedFiles: string[] };

export type Engine = (input: EngineInput) => Finding[] | EngineOutcome | Promise<Finding[] | EngineOutcome>;

export type CheckRunner = (session: Session, planned: PlannedCheck, staged?: Set<string>) => Promise<CheckResult>;

export type RunOptions = PlanOptions & {
    onResult?: (result: CheckResult) => void;
    fix: boolean;
    isDryRun: boolean;
    noCache?: boolean;
    comparison?: NonNullable<RunReport['comparison']>;
    cancelSignal?: AbortSignal;
};

export type RunOutcome = { report: RunReport; planned: PlannedCheck[]; fixes?: FixReport };

export type FixResult = { check: string; changed: string[] } & (
    | { status: 'changed' | 'unchanged' | 'skipped' }
    | { status: 'failed'; note: string }
);

export type FixReport = { results: FixResult[]; changed: string[]; diffs: string[] };

export type IgnoreUse = { entry: IgnoreEntry; matched: number };

export type InlineIgnore = { line: number; check: string; reason?: string };

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
    run: CheckRunner;
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

export type ScopeSelection = {
    scope: ScopeEntry;
    selected: Manifest[];
    surface: ExposedSettings;
    view: MergedView;
};

export type Session = ToolContext & {
    resources?: DisposableStack;
    packageManager?: import('zod').infer<typeof import('#cli/emit/tool-packages.ts').packageManagerSchema>;
    cancelSignal?: AbortSignal;
    version: string;
    policyFiles: PolicyFiles;
    manifests: Map<string, Manifest>;
    repository: Repository;
    scopes: ScopeSelection[];
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

export type PreparedCommand = {
    root: string;
    cwd: string;
    argv: string[];
    commands: ToolInvocation[];
    env: Record<string, string>;
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
