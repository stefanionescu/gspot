// The types of commands/init in this package.
import type { Read } from '#cli/types/platform.ts';
import type { Profile } from '#cli/types/policy/profiles.ts';
import type { Policy, RawPolicy } from '#cli/types/policy/policy.ts';
import type { AdoptionResult, AdoptedFormatting } from '#cli/types/policy/adoption.ts';
import type { Manifest, SettingSpec, UnknownLanguage, KitEvidence as Plan } from '#cli/types/kits.ts';

import type {
    Fields,
    TomlTable,
    Repository,
    ScopeEntry,
    TrackedFile,
    ExistingTooling,
} from '#cli/types/repository/repository.ts';

export type Planning = {
    root: string;
    options: InitOptions;
    tooling: ExistingTooling;
    selection: InitSelection;
    everySelected: Manifest[];
    answers: InitAnswers;
    kept: AdoptionResult;
};
export type DetectionSummary = {
    files: TrackedFile[];
    plans: Plan[];
    scopes: ScopeEntry[];
    tooling: ExistingTooling;
    owned: string[];
    unowned: string[];
    unknown: UnknownLanguage[];
    manifests: Map<string, Manifest>;
    hasGit: boolean;
};
export type KitReason = 'named' | 'detected' | 'recommended' | 'required';
export type Detect = NonNullable<SettingSpec['detect']>;
export type DetectedSetting = { key: string; value: unknown; kit: string };
export type InitOptions = {
    cwd: string;
    yes: boolean;
    isDryRun: boolean;
    json: boolean;
    kits?: string[];
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
    plan?: ReplacePlan;
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
    scopePlans: Map<string, string[]>;
    selectedIds: Set<string>;
    rootPlans: Plan[];
    how: Map<string, KitReason>;
};
/** The answers init collects from flags or the terminal. */
export type InitAnswers = {
    hooks: NonNullable<Policy['hooks']>['tool'] | 'none';
    ci: NonNullable<Policy['ci']>['provider'] | 'none';
    isRules: boolean;
    runner: NonNullable<Policy['runner']>['tool'] | 'none';
    formatter?: AdoptedFormatting;
};
/** Everything init computes before it asks to continue. */
export type InitPrepared = {
    plan: ReplacePlan;
    policyText: string;
    runner: InitAnswers['runner'];
    removed: { path: string }[];
    read: Map<string, Read>;
};
/** What init selection reads. */
export type InitContext = {
    manifests: Map<string, Manifest>;
    files: TrackedFile[];
    fields: Fields[];
    options: InitOptions;
    /** Whether the folder is a git repository; a configuration whose checks all read git stays out otherwise. */
    hasGit: boolean;
};
/** The inputs to init selection. */
export type InitInputs = {
    root: string;
    repo: Repository;
    fields: Fields[];
    workspace: ScopeEntry[];
    manifests: Map<string, Manifest>;
    options: InitOptions;
};
export type InitPlan = {
    profileTables?: TomlTable;
    kits: string[];
    scopes: { path: string; kits: string[] }[];
    kept: AdoptionResult;
    hooks: NonNullable<RawPolicy['hooks']>['tool'] | 'none';
    ci: NonNullable<RawPolicy['ci']>['provider'] | 'none';
    rules: boolean;
    runner: NonNullable<RawPolicy['runner']>['tool'] | 'none';
    runnerTasks?: NonNullable<RawPolicy['runner']>['tasks'];
    formatter?: AdoptedFormatting;
    /** The Xcode project and scheme init found, for the tools.xcode table. */
    xcode?: { scope: string; project: string; scheme?: string };
    /** The settings init filled from the repository through their detect tables. */
    detected?: DetectedSetting[];
    commitScopes?: string[];
};
export type Written = { lines: string[]; installNote: string; exitCode: number };
export type Installed = { installNote: string; exitCode: number };
export type InstallSettings = { min_release_age_days?: number; security_scanner?: string };
export type ReplacePlan = {
    ci?: { commands: string[]; reports: string };
    profile?: { name: string; digest: string; selection: string; detected: string[] };
    kits: { kit: string; how: KitReason; checks: number }[];
    write: { path: string; note: string }[];
    remove: { path: string; note: string }[];
    unread: { path: string; note: string }[];
    retained: { path: string; note: string }[];
    kept: { from: string; count: number; into: string }[];
    change: { path: string; note: string }[];
    noLongerRuns: { path: string; note: string }[];
    ignores: { check: string; rule?: string; reason: string }[];
};
