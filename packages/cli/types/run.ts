import type { RunReport } from '#types/report.ts';
import type { ToolContext } from '#types/doctor.ts';
import type { CheckResult, Finding } from '#types/finding.ts';
import type { TrackedFile, Repository, ScopeEntry } from '#types/repository.ts';
// Type aliases of the run modules.
import type { CheckSpec, Manifest, OutputFormat, ToolPin } from '#types/manifest.ts';
import type { IgnoreEntry, PolicyFiles, MergedView, ExposedSettings } from '#types/config.ts';

export type BaselineFile = {
    check: string;
    rule: string;
    count: number;
    recorded: string;
    paths: Record<string, number>;
};

export type CacheKeyInput = {
    check: string;
    scope: string;
    toolVersion: string;
    configurationHash: string;
    files: { path: string; hash: string }[];
    extra?: string;
};

export type CheckOptions = {
    cwd: string;
    only?: string[];
    paths: string[];
    staged: boolean;
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

export type EngineInput = {
    session: Session;
    root: string;
    scope: string;
    view: MergedView;
    spec: CheckSpec;
    files: TrackedFile[];
    staged?: Set<string>;
};

export type Engine = (input: EngineInput) => Promise<Finding[]>;

export type ToolAnalysis = (session: Session, planned: PlannedCheck) => Promise<CheckResult>;

export type RunOptions = PlanOptions & { fix: boolean; isDryRun: boolean; noCache?: boolean; comparison?: string };

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
    stage: StageFilter;
    staged?: string[];
    changed?: string[];
    only?: string[];
    /** Root-relative paths selected by positional file and directory arguments. */
    paths?: string[];
    skips: string[];
    localSkips: string[];
    messageFile?: string;
};

export type PlannedCheck = {
    check: string;
    scope: ScopeSelection;
    spec: CheckSpec;
    manifest?: Manifest;
    files: TrackedFile[];
    tool?: ToolPin;
    skip?: { source: 'local' | 'flag' | 'platform' | 'rules'; note: string };
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
    version: string;
    policyFiles: PolicyFiles;
    manifests: Map<string, Manifest>;
    repository: Repository;
    scopes: ScopeSelection[];
};

export type EslintEntry = {
    ruleId: string | null;
    line?: number;
    column?: number;
    message: string;
    fix?: unknown;
    severity: number;
};

export type CommandPart = string | { file: true };

export type Substitutions = {
    files: string[];
    scope: string;
    root: string;
    messageFile?: string;
    mergeBase?: string;
    indent: number;
};

/** What one tool run accumulates across its spawns. */
export type ToolRunState = { root: string; cwd: string; findings: Finding[]; isFailed: boolean };

/** One file entry from the ESLint JSON formatter. */
export type EslintFile = { filePath: string; messages: EslintEntry[] };

/** A tool command expanded and ready to spawn: once, or once per file. */
export type PreparedCommand = {
    root: string;
    cwd: string;
    argv: string[];
    commands: string[][];
    env: Record<string, string>;
};

/** What the regex output parser needs per line: the format, the compiled fixable pattern and the help text. */
export type RegexParser = { output: OutputFormat; fixable: RegExp | undefined; help: string };

/** What the run filters findings through: the baseline files, the [[ignore]] entries and the staged paths. */
export type FilterInputs = { baselines: BaselineFile[]; ignores: IgnoreEntry[]; staged: Set<string> | undefined };

/** What filtering one check's findings produced. */
/** One result on its way through the filters: the check, its result, and the findings no ignore took. */
export type Sifted = { check: PlannedCheck; result: CheckResult; remaining: Finding[] };

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

/** Findings of one check and rule, counted per path. */
export type RuleCount = { check: string; rule: string; count: number; paths: Record<string, number> };
