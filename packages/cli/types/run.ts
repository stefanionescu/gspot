import type { Finding } from '#types/finding.ts';
import type { BaselineVerdict, RunRecord } from '#types/record.ts';
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
    id: string;
    scope: string;
    toolVersion: string;
    configurationHash: string;
    files: { path: string; hash: string }[];
    extra?: string;
};

export type CheckOptions = {
    cwd: string;
    check?: string;
    staged: boolean;
    since?: string;
    fix: boolean;
    isDryRun: boolean;
    stage?: StageFilter;
    scope?: string;
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

export type RunOptions = PlanOptions & { fix: boolean; isDryRun: boolean; noCache?: boolean };

export type RunOutcome = { record: RunRecord; planned: PlannedCheck[]; fixes?: FixReport };

export type FixReport = { ran: { id: string; files: number }[]; changed: string[]; diffs: string[] };

export type IgnoreUse = { entry: IgnoreEntry; matched: number };

export type InlineIgnore = { line: number; check: string; reason?: string };

export type StageFilter = 'all' | 'commit' | 'push' | 'manual' | 'message';

export type PlanOptions = {
    stage: StageFilter;
    staged?: string[];
    since?: string[];
    only?: string;
    scope?: string;
    skips: string[];
    localSkips: string[];
    fix?: boolean;
    messageFile?: string;
};

export type PlannedCheck = {
    id: string;
    scope: ScopeSelection;
    spec: CheckSpec;
    manifest?: Manifest;
    files: TrackedFile[];
    tool?: ToolPin;
    skip?: { source: 'local' | 'flag' | 'platform' | 'rules'; note: string };
    projectWide: boolean;
    messageFile?: string;
};

export type ScopeSelection = {
    scope: ScopeEntry;
    selected: Manifest[];
    surface: ExposedSettings;
    view: MergedView;
};

export type Session = {
    root: string;
    version: string;
    policyFiles: PolicyFiles;
    manifests: Map<string, Manifest>;
    repository: Repository;
    scopes: ScopeSelection[];
    problems: string[];
};

export type EslintEntry = {
    ruleId: string | null;
    line?: number;
    column?: number;
    message: string;
    fix?: unknown;
    severity: number;
};

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
export type PreparedCommand = { root: string; cwd: string; argv: string[]; commands: string[][] };

/** What the regex output parser needs per line: the format, the compiled fixable pattern and the help text. */
export type RegexParser = { output: OutputFormat; fixable: RegExp | undefined; help: string };

/** What the run filters findings through: the baseline files, the [[ignore]] entries and the staged paths. */
export type FilterInputs = { baselines: BaselineFile[]; ignores: IgnoreEntry[]; staged: Set<string> | undefined };

/** What filtering one check's findings produced. */
export type FilterVerdicts = { verdicts: BaselineVerdict[]; uses: IgnoreUse[] };

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

/** What a spawned command left behind, for tests. */
export type SpawnOutcome = { code: number; stdout: string; stderr: string };

/** A local npm registry the release tests publish into. */
export type Registry = { url: string; npmrc: string; work: string; stop: () => void };
