import type { Profile } from '#cli/profile/types.ts';
// init and uninstall: their options, the selection, the questions, the takeover plan and the carried lists.
import type { TomlTable, Policy, EslintSettings } from '#cli/policy/types.ts';
import type { Manifest, Proposal, UnknownLanguage } from '#cli/presets/types.ts';
import type { ExistingTooling, ManifestFacts, Repository, ScopeEntry, TrackedFile } from '#cli/repository/types.ts';

export type TakeoverPlan = {
    profile?: { name: string; digest: string; selection: string; detected: string[] };
    presets: { preset: string; how: PresetReason; checks: number }[];
    write: { path: string; note: string }[];
    remove: { path: string; note: string }[];
    unread: { path: string; note: string }[];
    retained: { path: string; note: string }[];
    carried: { from: string; count: number; into: string }[];
    change: { path: string; note: string }[];
    noLongerRuns: { path: string; note: string }[];
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

export type InitResult = { text: string; json: Record<string, unknown>; exitCode: number };

export type CarriedIgnore = { check: string; rule?: string; reason: string; paths?: string[] };

export type CarriedFormatter = { format: Policy['format']; extra?: TomlTable; ignorePatterns?: string[] };

export type CarriedLists = {
    formatter?: CarriedFormatter;
    eslintAdopted?: EslintSettings['adopted'];
    observed: Map<string, FileSnapshot>;
    typosWords: { word: string; reason: string }[];
    typosExcludes: { paths: string[]; reason: string }[];
    /** The paths an old pyrightconfig.json at the root left out of the type check. */
    pyrightExcludes: { paths: string[]; reason: string }[];
    /** The locale the old typos file checked against; a file that names none accepts every English dialect. */
    typosLocale?: string;
    sqlfluffExcludes: { paths: string[]; reason: string }[];
    semgrepIgnores: { paths: string[]; reason: string }[];
    gitleaksAllow: {
        description: string;
        paths: string[];
        regexes: string[];
        regex_target?: string;
        condition?: string;
        reason: string;
    }[];
    osvIgnores: { id: string; reason: string; review_by?: string }[];
    licenseExceptions: { package: string; license: string; reason: string }[];
    licenseAllow: string[];
    ignores: CarriedIgnore[];
    removed: { path: string; note: string }[];
    unread: { path: string; note: string }[];
    retained: { path: string; note: string }[];
};

export type UninstallPlan = { remove: string[]; blocks: string[]; hooks: boolean };

/** gspot uninstall. */
export type UninstallOptions = { cwd: string; yes: boolean; isDryRun: boolean };

/** Original takeover text and the parsed settings used by every carry reader. */
export type CarrySource = { text: string; parsed: TomlTable; original: FileSnapshot };

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
    how: Map<string, PresetReason>;
    answers: InitAnswers;
    carried: CarriedLists;
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

export type FileSnapshot = { bytes: Buffer; mode: number; isLink?: true };

export type ConfinedRoot = {
    validate(path: string, value: FileSnapshot): void;
    readEntry(path: string): FileSnapshot | undefined;
    read(path: string): FileSnapshot | undefined;
    write(path: string, value: FileSnapshot, expected: FileSnapshot | undefined): void;
    remove(path: string, expected: FileSnapshot): void;
    mkdir(path: string, mode: number): void;
    lock(path: string): void;
    close(): void;
};

export type OwnershipState = import('zod').infer<typeof import('#cli/lifecycle/ownership.ts').ownershipSchema>;
export type OwnershipEntry = OwnershipState['files'][number];
export type FileProposal = {
    path: string;
    current: FileSnapshot | undefined;
    previous: OwnershipEntry | undefined;
    status: 'changed' | 'unchanged' | 'preserved';
    next?: FileSnapshot;
    entry?: OwnershipEntry;
    saveOriginal?: boolean;
};

export type LifecycleOwner = {
    beginInstallation(kind: 'npm' | 'python'): void;
    finishInstallation(kind: 'npm' | 'python'): void;
    proposeConfiguration(
        path: string,
        format: 'json' | 'yaml',
        changes: { path: string[]; value: unknown }[],
        takeover?: boolean,
    ): FileProposal;
    proposeReplacement(
        path: string,
        next: FileSnapshot,
        kind: OwnershipEntry['kind'],
        takeover?: boolean,
        expected?: FileSnapshot,
    ): FileProposal;
    proposeBlock(path: string, body: string, style: import('#cli/emit/types.ts').BlockStyle): FileProposal;
    applyProposal(proposal: FileProposal): 'changed' | 'unchanged' | 'preserved';
    applyProposals(proposals: FileProposal[]): ('changed' | 'unchanged' | 'preserved')[];
    replaceBlock(
        path: string,
        body: string,
        style: import('#cli/emit/types.ts').BlockStyle,
    ): 'changed' | 'unchanged' | 'preserved';
    read(path: string): FileSnapshot | undefined;
    paths(): string[];
    installedPaths(): string[];
    proposeRetirement(path: string, expected: FileSnapshot): FileProposal;
    replace(
        path: string,
        next: FileSnapshot,
        kind: OwnershipEntry['kind'],
        takeover?: boolean,
        expected?: FileSnapshot,
    ): 'changed' | 'unchanged' | 'preserved';
    proposeRestoration(path: string, original?: FileSnapshot): FileProposal;
    restore(path: string, original?: FileSnapshot): 'changed' | 'preserved';
    close(): void;
};

export type TakeoverRemovalResult = { removed: string[]; preserved: string[] };

export type HookLocation = { root: string; directory: string; absolute: string };
