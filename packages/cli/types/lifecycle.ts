import type { BaselineFile } from '#types/run.ts';
// init, upgrade and uninstall: their options, the selection, the questions, the takeover plan and the carried lists.
import type { RunRecord } from '#types/record.ts';
import type { FormatSettings } from '#types/config.ts';
import type { Manifest, Proposal, UnknownLanguage } from '#types/manifest.ts';
import type { ExistingTooling, ManifestFacts, Repository, ScopeEntry, TrackedFile } from '#types/repository.ts';

export type TakeoverPlan = {
    presets: { id: string; how: PresetReason; checks: number }[];
    write: { path: string; note: string }[];
    remove: { path: string; note: string }[];
    unread: { path: string; note: string }[];
    carried: { from: string; count: number; into: string }[];
    change: { path: string; note: string }[];
    noLongerRuns: { path: string; note: string }[];
    baselines: { rules: number; findings: number };
    ignores: { check: string; rule?: string; reason: string }[];
};

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
    allowDirty: boolean;
    projectTemplates: boolean;
};

export type InitResult = { text: string; json: Record<string, unknown>; exitCode: number };

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
    unread: { path: string; note: string }[];
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
    how: Map<string, PresetReason>;
};

/** Why init selected a preset. */
export type PresetReason = 'named' | 'detected' | 'recommended' | 'required';

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

/** Everything init computes before it asks to continue. */
export type InitPrepared = {
    plan: TakeoverPlan;
    policyText: string;
    runner: InitAnswers['runner'];
    removed: { path: string }[];
};

/** The inputs to the init plan. */
export type InitPlanInputs = {
    root: string;
    tooling: ExistingTooling;
    everySelected: Manifest[];
    how: Map<string, PresetReason>;
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
