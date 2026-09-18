import type { RunRecord } from '#types/record.ts';
import type { BaselineFile, ScopeSelection, Session } from '#types/run.ts';
import type { FormatSettings, Policy, MergedView } from '#types/config.ts';
import type { ConfigurationTarget, Manifest, Proposal, UnknownLanguage } from '#types/manifest.ts';
import type { ExistingTooling, ManifestFacts, Repository, ScopeEntry, TrackedFile } from '#types/repository.ts';
// Generated files: what apply renders, and what drift compares.

export type GeneratedFile = {
    path: string;
    content: string;
    readOnly: boolean;
    executable?: boolean;
    kind: 'config' | 'stub' | 'hook' | 'runner' | 'workflow' | 'rules' | 'baseline' | 'version' | 'managed-block';
    preset?: string;
};

export type DriftEntry = {
    path: string;
    kind: 'changed' | 'missing' | 'stray';
    diff?: string;
};

export type TakeoverPlan = {
    write: { path: string; note: string }[];
    remove: { path: string; note: string }[];
    carried: { from: string; count: number; into: string }[];
    change: { path: string; note: string }[];
    noLongerRuns: { path: string; note: string }[];
    baselines: { rules: number; findings: number };
    ignores: { check: string; rule?: string; reason: string }[];
};

export type HookName = 'pre-commit' | 'pre-push' | 'commit-msg';

export type InitOptions = {
    cwd: string;
    yes: boolean;
    isDryRun: boolean;
    json: boolean;
    presets?: string[];
    without?: string[];
    scopes?: string[];
    own?: string[];
    hooks?: 'gspot' | 'lefthook' | 'husky' | 'none';
    ci?: 'github' | 'none';
    rules?: 'yes' | 'no';
    format?: 'keep' | 'shipped';
    runner?: 'mise' | 'npm' | 'bun' | 'pnpm' | 'uv' | 'none';
    install: boolean;
    projectTemplates: boolean;
    binaryPath?: string;
};

export type InitResult = { text: string; json: Record<string, unknown>; exitCode: number };

export type BlockStyle = 'markdown' | 'hash';

export type ApplyReport = {
    written: string[];
    unchanged: string[];
    removed: string[];
    blocks: string[];
    packages: string[];
    notes: string[];
};

export type ApplyOptions = {
    cwd: string;
    check: boolean;
    baseline: boolean;
    projectTemplates: boolean;
    binaryPath?: string;
};

export type CarriedIgnore = { check: string; rule: string; reason: string; paths?: string[] };

export type CarriedLists = {
    typosWords: { word: string; reason: string }[];
    typosExcludes: { paths: string[]; reason: string }[];
    gitleaksAllow: { description: string; paths: string[]; regexes: string[]; reason: string }[];
    osvIgnores: { id: string; reason: string; review_by?: string }[];
    licenseExceptions: { package: string; license: string; reason: string }[];
    licenseAllow: string[];
    ignores: CarriedIgnore[];
    removed: { path: string; note: string }[];
};

export type BlockOutput = { path: string; block: string; style: 'markdown' | 'hash' };

export type MergeOutput = {
    path: string;
    content: string;
    keys: string[];
    target: string;
    stub: ConfigurationTarget['stub'] & object;
};

export type PackageOutput = { path: string; devDependencies: Record<string, string>; scripts: Record<string, string> };

export type LefthookOutput = { path: string; block: LefthookBlock };

export type RenderedSet = {
    files: GeneratedFile[];
    blocks: BlockOutput[];
    merges: MergeOutput[];
    packages: PackageOutput[];
    lefthook?: LefthookOutput;
};

export type TemplateInputs = {
    prose: { packages: string[]; blockIgnores: string[]; tokenIgnores: string[]; disabledUpstream: [string, string][] };
    version: string;
    scope: string;
    scopes: { path: string; presets: string[] }[];
    presets: string[];
    policy: Policy;
    view: MergedView;
    format: MergedView['format'];
    settings: Record<string, unknown>;
    fragments: string;
    tool: (name: string) => Record<string, unknown>;
    toolEnabled: (name: string) => boolean;
    limit: (key: string, language?: string) => number | undefined;
    rulesOff: (check: string) => string[];
    ignoresFor: MergedView['ignoresFor'];
    extra: (name: string) => Record<string, unknown> | undefined;
    json: (value: unknown, indent?: number) => string;
    tomlString: (value: string) => string;
    has: (preset: string) => boolean;
    files: (extension: string) => string[];
    importAliases: (scope: string) => Record<string, string>;
    tools: string[];
    header: string;
    headerLines: string[];
};

export type UninstallPlan = { remove: string[]; blocks: string[]; hooksPath: boolean };

/** gspot uninstall. */
export type UninstallOptions = { cwd: string; isHooksKept: boolean; yes: boolean; isDryRun: boolean };

export type UpgradeOptions = {
    cwd: string;
    check: boolean;
    to?: string;
    yes: boolean;
    install: boolean;
    binaryPath?: string;
};

/** Adds one carried ignore: a rule the old configuration turned off, with the paths it applied to when it had any. */
export type CarryPush = (rule: string, paths?: string[]) => void;

/** What init detected, for the header it prints before the plan. */
export type DetectionSummary = {
    files: TrackedFile[];
    proposals: Proposal[];
    scopes: ScopeEntry[];
    tooling: ExistingTooling;
    owned: string[];
    unowned: string[];
    unknown: UnknownLanguage[];
    manifests: Map<string, Manifest>;
};

/** The presets init selects: at the root, per scope, and the closure of both. */
export type InitSelection = {
    scopes: ScopeEntry[];
    rootIds: string[];
    scopeProposals: Map<string, string[]>;
    selectedIds: Set<string>;
    rootProposals: Proposal[];
};

/** The answers init collects from flags or the terminal. */
export type InitAnswers = {
    hooks: 'gspot' | 'lefthook' | 'husky' | 'none';
    ci: 'github' | 'none';
    isRules: boolean;
    runner: 'mise' | 'npm' | 'bun' | 'pnpm' | 'uv' | 'none';
    format?: Partial<FormatSettings>;
};

/** The first check run after init and the baselines it wrote. */
/** A baseline a tool wrote itself at init: the check, its scope and how many findings it covers. */
export type ToolBaseline = { check: string; scope: string; count: number };

export type FirstRun = { record: RunRecord; baselines: BaselineFile[]; toolBaselines: ToolBaseline[] };

/** The part of package.json the alias reader looks at. */
export type PackageImports = { imports?: Record<string, unknown> };

/** The part of tsconfig.json the alias reader looks at. */
export type TsconfigPaths = { compilerOptions?: { paths?: Record<string, string[]> } };

/** The part of package.json apply reads and writes. */
export type PackageContent = { devDependencies?: Record<string, string>; scripts?: Record<string, string> };

/** Everything init computes before it asks to continue. */
export type InitPrepared = {
    plan: TakeoverPlan;
    policyText: string;
    runner: InitAnswers['runner'];
    removed: { path: string }[];
};

/** What rendering one manifest's files in one scope needs. */
export type EmitContext = { session: Session; selection: ScopeSelection; manifest: Manifest };

/** What the workflow emitter needs to know. */
export type WorkflowShape = {
    version: string;
    platforms: string[];
    /** The Swift scope path, or undefined when no scope selects swift. */
    swiftScope: string | undefined;
    isMise: boolean;
};

/** How generated JSON is laid out: the Prettier print width and indent width. */
export type JsonFormat = { width: number; indent: number };

/** The hook commands lefthook.yml carries per hook. */
export type LefthookBlock = Record<string, { commands: Record<string, unknown> }>;

/** The inputs to the init plan. */
export type InitPlanInputs = {
    root: string;
    tooling: ExistingTooling;
    everySelected: Manifest[];
    answers: InitAnswers;
    carried: CarriedLists;
    policyLines: number;
};

/** What init selection reads. */
export type InitContext = {
    manifests: Map<string, Manifest>;
    files: TrackedFile[];
    facts: ManifestFacts[];
    options: InitOptions;
};

/** The inputs to init selection. */
export type InitInputs = {
    root: string;
    repo: Repository;
    facts: ManifestFacts[];
    workspace: ScopeEntry[];
    manifests: Map<string, Manifest>;
    options: InitOptions;
};

/** What an upgrade changes, section by section. */
export type UpgradeReport = {
    tools: { tool: string; from?: string; to: string; requiredBy: string }[];
    rules: { rule: string; path: string; kind: 'added' | 'removed' }[];
    files: { path: string; kind: 'new' | 'removed' | 'changed'; lines?: number }[];
    ruleFiles: { path: string; kind: 'new' | 'removed' | 'changed'; lines?: number }[];
    presets: { preset: string; evidence: string }[];
    extras: { tool: string; key: string; scope: string }[];
};
