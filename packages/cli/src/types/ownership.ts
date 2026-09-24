import type { FileSnapshot } from '#cli/types/filesystem.ts';
import type { Policy, RawPolicy, TomlTable } from '#cli/types/policy.ts';
// Ownership proposals, adopted settings, and restoration records.
import type { Manifest, Proposal, UnknownLanguage } from '#cli/types/configurations.ts';
import type { ExistingTooling, ScopeEntry, TrackedFile } from '#cli/types/repository.ts';

export type PreparedHook = { generated: string; installed: string };

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

export type CarriedIgnore = { check: string; rule?: string; reason: string; paths?: string[] };

export type CarriedFormatter = {
    format: Policy['format'];
    extra?: TomlTable;
    ignorePatterns?: string[];
    nativeDefaults?: boolean;
    editorconfig?: NonNullable<NonNullable<RawPolicy['tools']>['editorconfig']>['adopted'];
};

export type CarriedLists = Map<string, { settings: TomlTable; ignores: CarriedIgnore[] }>;

export type CarriedConfiguration = {
    tools: CarriedLists;
    scopes: Map<string, { configurations: string[]; tools: Record<string, TomlTable> }>;
    formatter?: CarriedFormatter;
    observed: Map<string, FileSnapshot>;
    removed: { path: string; note: string }[];
    unread: { path: string; note: string }[];
    retained: { path: string; note: string }[];
};

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

/** Why init selected a configuration. */
export type ConfigurationReason = 'named' | 'detected' | 'recommended' | 'required';

export type OwnershipState = import('zod').infer<typeof import('#cli/schemas/ownership.ts').ownershipSchema>;
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
        format: 'json' | 'yaml' | 'toml',
        changes: { path: (string | number)[]; value: unknown }[],
        takeover?: boolean,
    ): FileProposal;
    proposeReplacement(
        path: string,
        next: FileSnapshot,
        kind: OwnershipEntry['kind'],
        takeover?: boolean,
        expected?: FileSnapshot,
        proposed?: ReadonlyMap<string, FileSnapshot | undefined>,
    ): FileProposal;
    proposeBlock(path: string, body: string, style: import('#cli/types/generation.ts').BlockStyle): FileProposal;
    applyProposal(proposal: FileProposal): 'changed' | 'unchanged' | 'preserved';
    applyProposals(proposals: FileProposal[]): ('changed' | 'unchanged' | 'preserved')[];
    replaceBlock(
        path: string,
        body: string,
        style: import('#cli/types/generation.ts').BlockStyle,
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

export type HookLocation = {
    root: string;
    directory: string;
    absolute: string;
    gitRoot: string;
    stateDirectory: string;
};

export type LegacyEslintMatcher = {
    pattern: string;
    negate: boolean;
    options: { matchBase?: boolean };
};
export type LegacyEslintCriteria = {
    basePath: string;
    patterns: { includes: LegacyEslintMatcher[] | null; excludes: LegacyEslintMatcher[] | null }[];
};
export type LegacyEslintDependency = {
    id: string;
    filePath: string;
    definition: unknown;
    original?: unknown;
    error?: Error | null;
};
export type LegacyEslintEntry = {
    type: string;
    name: string;
    criteria: LegacyEslintCriteria | null;
    ignorePattern?: { basePath: string; patterns: string[]; loose: boolean };
    parser?: LegacyEslintDependency;
    plugins?: Record<string, LegacyEslintDependency>;
    [key: string]: unknown;
};
export type LegacyEslintApi = {
    Legacy: {
        ConfigArrayFactory: new (options: Record<string, unknown>) => {
            loadFile(path: string): LegacyEslintEntry[];
            loadInDirectory(path: string): LegacyEslintEntry[];
            loadDefaultESLintIgnore(): LegacyEslintEntry[];
        };
        IgnorePattern: { DefaultPatterns: string[] };
        naming: { normalizePackageName(name: string, prefix: string): string };
    };
    FlatCompat: new (options: Record<string, unknown>) => {
        config(configuration: Record<string, unknown>): Record<string, unknown>[];
    };
};
