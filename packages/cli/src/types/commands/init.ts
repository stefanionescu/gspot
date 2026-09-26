// The types of commands/init in this package.
import type { FileSnapshot } from '#cli/types/platform.ts';
import type { Profile } from '#cli/types/policy/profiles.ts';
import type { Policy, RawPolicy, RunnerTaskNames } from '#cli/types/policy/policy.ts';
import type { CarriedConfiguration, CarriedFormatter } from '#cli/types/policy/adoption.ts';

import type {
    ConfigurationEvidence as Proposal,
    Manifest,
    SettingSpec,
    UnknownLanguage,
} from '#cli/types/configurations.ts';
import type {
    ExistingTooling,
    ManifestFacts,
    Repository,
    ScopeEntry,
    TomlTable,
    TrackedFile,
} from '#cli/types/repository/repository.ts';

export type Planning = {
    root: string;
    options: InitOptions;
    tooling: ExistingTooling;
    selection: InitSelection;
    everySelected: Manifest[];
    answers: InitAnswers;
    carried: CarriedConfiguration;
};
export type DetectionSummary = {
    files: TrackedFile[];
    proposals: Proposal[];
    scopes: ScopeEntry[];
    tooling: ExistingTooling;
    owned: string[];
    unowned: string[];
    unknown: UnknownLanguage[];
    manifests: Map<string, Manifest>;
    hasGit: boolean;
};
export type ConfigurationReason = 'named' | 'detected' | 'recommended' | 'required';
export type Detect = NonNullable<SettingSpec['detect']>;
export type DetectedSetting = { key: string; value: unknown; configuration: string };
export type InitOptions = {
    cwd: string;
    yes: boolean;
    isDryRun: boolean;
    json: boolean;
    configurations?: string[];
    without?: string[];
    scopes?: string[];
    hooks?: NonNullable<Policy['hooks']>['tool'] | 'none';
    ci?: NonNullable<Policy['ci']>['provider'] | 'none';
    rules?: 'yes' | 'no';
    format?: 'keep' | 'shipped';
    runner?: NonNullable<Policy['runner']>['tool'] | 'none';
    from?: string;
    profile?: Profile;
    isListExact?: boolean;
    install: boolean;
    allowDirty: boolean;
};
/** The JSON the init command prints: the plan, the policy it wrote or previewed, and what stopped it. */
export type InitJson = {
    root?: string;
    plan?: TakeoverPlan;
    policy?: string;
    isDryRun?: boolean;
    written?: boolean;
    error?: string;
    install?: string;
};
export type InitResult = { text: string; json: InitJson; exitCode: number };
/** The configurations init selects: at the root, per scope, and the closure of both. */
export type InitSelection = {
    scopes: ScopeEntry[];
    rootIds: string[];
    scopeProposals: Map<string, string[]>;
    selectedIds: Set<string>;
    rootProposals: Proposal[];
    how: Map<string, ConfigurationReason>;
};
/** The answers init collects from flags or the terminal. */
export type InitAnswers = {
    hooks: NonNullable<Policy['hooks']>['tool'] | 'none';
    ci: NonNullable<Policy['ci']>['provider'] | 'none';
    isRules: boolean;
    runner: NonNullable<Policy['runner']>['tool'] | 'none';
    formatter?: CarriedFormatter;
};
/** Everything init computes before it asks to continue. */
export type InitPrepared = {
    plan: TakeoverPlan;
    policyText: string;
    runner: InitAnswers['runner'];
    removed: { path: string }[];
    observed: Map<string, FileSnapshot>;
};
/** The inputs to the init plan. */
export type InitPlanInputs = {
    profile?: TakeoverPlan['profile'];
    root: string;
    tooling: ExistingTooling;
    everySelected: Manifest[];
    how: Map<string, ConfigurationReason>;
    answers: InitAnswers;
    runnerTasks?: RunnerTaskNames;
    carried: CarriedConfiguration;
    policyLines: number;
    /** Instruction destinations resolved from the final proposed policy. */
    agents: string[];
};
/** What init selection reads. */
export type InitContext = {
    manifests: Map<string, Manifest>;
    files: TrackedFile[];
    facts: ManifestFacts[];
    options: InitOptions;
    /** Whether the folder is a git repository; a configuration whose checks all read git stays out otherwise. */
    hasGit: boolean;
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
export type InitProposal = {
    profileTables?: TomlTable;
    configurations: string[];
    scopes: { path: string; configurations: string[] }[];
    carried: CarriedConfiguration;
    hooks: NonNullable<RawPolicy['hooks']>['tool'] | 'none';
    ci: NonNullable<RawPolicy['ci']>['provider'] | 'none';
    rules: boolean;
    runner: NonNullable<RawPolicy['runner']>['tool'] | 'none';
    runnerTasks?: NonNullable<RawPolicy['runner']>['tasks'];
    formatter?: CarriedFormatter;
    /** The Xcode project and scheme init found, for the tools.xcode table. */
    xcode?: { scope: string; project: string; scheme?: string };
    /** The settings init filled from the repository through their detect tables. */
    detected?: DetectedSetting[];
    commitScopes?: string[];
};
export type Written = { lines: string[]; installNote: string; exitCode: number };
export type Installed = { installNote: string; exitCode: number };
export type InstallSettings = { min_release_age_days?: number; security_scanner?: string };
export type TakeoverPlan = {
    profile?: { name: string; digest: string; selection: string; detected: string[] };
    configurations: { configuration: string; how: ConfigurationReason; checks: number }[];
    write: { path: string; note: string }[];
    remove: { path: string; note: string }[];
    unread: { path: string; note: string }[];
    retained: { path: string; note: string }[];
    carried: { from: string; count: number; into: string }[];
    change: { path: string; note: string }[];
    noLongerRuns: { path: string; note: string }[];
    ignores: { check: string; rule?: string; reason: string }[];
};
