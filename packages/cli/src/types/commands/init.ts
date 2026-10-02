// The types of commands/init in this package.
import type { Read } from '#cli/types/platform/platform.ts';
import type { Profile } from '#cli/types/policy/profiles.ts';
import type { Manifest, KitEvidence as Plan } from '#cli/types/kits.ts';
import type { Policy, RawPolicy, TomlTable } from '#cli/types/policy/policy.ts';
import type { Fields, Repository, ScopeEntry, TrackedFile, ExistingTooling } from '#cli/types/repository/repository.ts';

export type Planning = {
    root: string;
    options: InitOptions;
    tooling: ExistingTooling;
    selection: InitSelection;
    everySelected: Manifest[];
    answers: InitAnswers;
    replaced: Replaced;
};

/** The authored configuration init replaces: what it read, what it deletes, and what stays for the developer. */
export type Replaced = {
    read: Map<string, Read>;
    removed: { path: string; note: string }[];
    unread: { path: string; note: string }[];
    retained: { path: string; note: string }[];
};
export type DetectionSummary = {
    files: TrackedFile[];
    plans: Plan[];
    scopes: ScopeEntry[];
    tooling: ExistingTooling;
    owned: string[];
    unowned: string[];
    manifests: Map<string, Manifest>;
    hasGit: boolean;
};
export type KitReason = 'named' | 'detected' | 'recommended' | 'required';
export type InitOptions = {
    cwd: string;
    yes: boolean;
    isDryRun: boolean;
    json: boolean;
    kits?: string[];
    scopes?: string[];
    hooks?: 'gspot' | 'none';
    ci?: NonNullable<Policy['ci']>['provider'] | 'none';
    rules?: 'yes' | 'no';
    runner?: NonNullable<Policy['runner']> | 'none';
    from?: string;
    profile?: Profile;
    isListExact?: boolean;
    install: boolean;
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
    hooks: 'gspot' | 'none';
    ci: NonNullable<Policy['ci']>['provider'] | 'none';
    isRules: boolean;
    runner: NonNullable<Policy['runner']> | 'none';
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
export type InitDetection = {
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
    hooks: 'gspot' | 'none';
    ci: NonNullable<RawPolicy['ci']>['provider'] | 'none';
    rules: boolean;
    runner: NonNullable<RawPolicy['runner']> | 'none';
    commitScopes?: string[];
};
export type Written = { lines: string[]; installNote: string; exitCode: number };
export type Installed = { installNote: string; exitCode: number };
export type ReplacePlan = {
    ci?: { commands: string[] };
    profile?: { name: string; digest: string; selection: string; detected: string[] };
    kits: { kit: string; how: KitReason; checks: number }[];
    write: { path: string; note: string }[];
    remove: { path: string; note: string }[];
    unread: { path: string; note: string }[];
    retained: { path: string; note: string }[];
    change: { path: string; note: string }[];
    noLongerRuns: { path: string; note: string }[];
};

export type ReplaceRemovalResult = { removed: string[]; preserved: string[] };
