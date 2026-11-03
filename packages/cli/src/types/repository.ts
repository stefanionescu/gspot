import type { z } from 'zod';
import type { Ignore } from 'ignore';
import type { GROUPS, FILE_KINDS } from '#cli/config/manifests.ts';
import type { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import type { KeyPath, DependencyFile } from '#cli/types/parsers.ts';
import type { SpawnResult, FileContents } from '#cli/types/system.ts';
import type { START_RUNNERS } from '#cli/config/repository/javascript.ts';
import type { LINT_COMMAND_FIXES } from '#cli/config/repository/setup.ts';
import type { Configuration, ParsedManifest } from '#cli/types/manifests.ts';

import type {
    gitFileSchema,
    gitIndexFileSchema,
    packageManagerSchema,
    packageManagerPinSchema,
    lintCommandPackageSchema,
} from '#cli/schemas/repository.ts';

export type ConfigurationOrigin = 'named' | 'template' | 'detected' | 'suggested' | 'required' | 'always';

export type ProposedConfigurations = {
    scopes: ScopeFolder[];
    rootNames: string[];
    scopeConfigurations: Map<string, string[]>;
    detected: ConfigurationEvidence[];
    origins: Map<string, ConfigurationOrigin>;
};

export type ConfigurationRequest = {
    repository: Repository;
    configurationsByName: ReadonlyMap<string, Configuration>;
    options: {
        configurations?: string[] | undefined;
        template?: { configurations: string[]; removed: string[] } | undefined;
    };
};

export type ConfigurationChoices = {
    template: Set<string>;
    named: Set<string>;
    detected: Set<string>;
    written: Set<string>;
};

export type Config = ParsedManifest['configs'][number];

export type Group = (typeof GROUPS)[number];

export type GitFile = z.infer<typeof gitFileSchema>;

export type GitIndexFile = z.infer<typeof gitIndexFileSchema>;

export type GitStream = { chunks: AsyncIterator<Buffer>; chunk: Buffer; cursor: number };

export type AttributePattern = { pattern: string; attributes: string[] };

export type SetupReference = {
    name: string;
    label: string;
    start: string;
    add: string;
    prerequisites: string[];
    lines: string[];
    clone: string[];
};

export type GitignoreMatcher = { base: string; matcher: Ignore };

export type ListedFile = { path: string; size: number; executable: boolean; isSymlink: boolean };

export type TrackedFile = {
    path: string;
    kind: FileKind;
    kindOrigin: string;
    tags: string[];
    executable: boolean;
    size: number;
    isUtf8?: boolean;
};

export type Repository = {
    root: string;
    attributes: Map<string, Record<string, string>>;
    index: GitIndexFile[];
    unreadablePaths: string[];
    files: TrackedFile[];
    dependencyFiles: DependencyFile[];
    scopeFolders: ScopeFolder[];
};

export type FileTags = { tags: string[]; isBinary: boolean };

export type FileKind = (typeof FILE_KINDS)[number];

export type GeneratedPaths = {
    scopePath: string;
    isMatch: (path: string) => boolean;
    kind: 'generated';
    configuration: string;
};

export type FileClassification = { kind: FileKind; origin: string };

export type ScopeFolder = {
    path: string;
    configurations: string[];
    origin: 'root' | typeof SETTINGS_FILE | 'project';
};

export type FileKindRules = { generatedPaths: GeneratedPaths[]; attributes: Repository['attributes'] };

export type CoveredFilesOptions = {
    configurations: Configuration[];
    scopePath: string;
    settings: { test_files: string[]; valuesByKey: Record<string, unknown> };
};

export type StartRunner = {
    name: keyof typeof START_RUNNERS;
    command: string;
    missing: string;
    installCommand: string;
};

export type PackageManager = z.infer<typeof packageManagerSchema>;

export type PackageManagerPin = z.infer<typeof packageManagerPinSchema>;

export type PackageManagerField = PackageManagerPin & { written: string; field: string };

export type PackageManagerCommand = { name: string; version?: string | undefined };

export type ScopeContents = {
    files: TrackedFile[];
    extensionCounts: Map<string, number>;
    runtimes: Map<string, string>;
    dependencies: Map<string, string>;
    scope: string;
};

export type ConfigurationEvidence = {
    configuration: string;
    evidence: string;
    group: Group;
    count?: number;
};

export type DetectionEvidence = { evidence: string; count?: number };

export type RepositoryReadOptions = {
    generatedPaths: GeneratedPaths[];
    scopes: Array<Pick<ScopeFolder, 'path' | 'configurations'>>;
    configurationsByName: ReadonlyMap<string, Configuration>;
};

export type RepositoryListing = Pick<Repository, 'root' | 'index' | 'attributes' | 'unreadablePaths'> & {
    files: Array<ListedFile & { prefix: Buffer }>;
};

export type RepositorySetup = {
    conflictingConfigs: ConflictingConfig[];
    hooks: Array<{
        kind: 'githooks' | 'husky' | 'lefthook' | 'simple-git-hooks' | 'pre-commit' | 'hooksPath';
        path: string;
        files: string[];
    }>;
    ci: string[];
    agentFiles: string[];
    ruleFolders: string[];
    lintFolders: string[];
};

export type ConflictingConfig = {
    tool: string;
    path: string;
    shared: boolean;
    table?: string;
    key?: string;
    pointer?: boolean;
};

type LintCommandSource = keyof typeof LINT_COMMAND_FIXES;

export type LintCommand = {
    file: string;
    line: number;
    source: LintCommandSource;
    command: string;
    tool: string;
    fix: string;
};

export type LintCommandSearch = {
    root: string;
    files: TrackedFile[];
    tools: ReadonlySet<string>;
    pins: Record<string, string>;
};

export type CommandSearch = Pick<LintCommandSearch, 'tools'> & { scripts: ReadonlyMap<string, string> };

export type LintCommandPlace = { file: string; text: string; source: LintCommandSource };

export type LintCommandPackage = { place: LintCommandPlace; manifest: z.infer<typeof lintCommandPackageSchema> };

export type RepositoryHooks = { hooksPath: string; hooks: RepositorySetup['hooks'] };

export type WritePlan = {
    path: string;
    status: 'changed' | 'unchanged' | 'refused';
    after?: FileContents;
};

export type ReplacementRequest = {
    path: string;
    next: FileContents;
    previous?: FileContents | undefined;
};

export type ManagedKeys = { path: string; keys: Array<{ key: KeyPath; value: JsonValue | undefined }> };

export type ConfigurationSelection = {
    repository: Repository;
    scopes: ReadonlyArray<{ path: string; configurations: Configuration[] }>;
    settings: {
        removed_configurations: string[];
        scopes: ReadonlyMap<string, { removed_configurations: string[] }>;
    };
};

export type Revision = { kind: 'index'; status?: TreeStatus } | { kind: 'commit'; hash: string };

export type PushRevision = {
    base: string;
    hash: string;
    tree: string;
    refs: string[];
    commits: string[];
    range: string[];
    shallow: boolean;
    paths?: string[];
};

export type PushedRevisions = {
    revisions: PushRevision[];
    skipped: Array<{
        ref: string;
        hash: string;
        reason: 'deleted ref' | 'non-commit object' | 'the commit has no gspot.toml' | 'no changed paths';
    }>;
};

export type PushLine = { localRef: string; localHash: string; remoteRef: string; remoteHash: string };

export type Comparison = { base: string; changed: string[] | undefined; range: string[] };

export type PushSearch = {
    defaultBranches: readonly string[];
    root: string;
    cancelSignal: AbortSignal | undefined;
    commits: Map<string, string | undefined>;
    remote: string | undefined;
    remoteRefs: ReadonlyMap<string, string>;
    boundaries: Set<string>;
};

export type MergeBase = { hash?: string; note?: string };

export type ChangedPaths = { reference: string; paths?: string[]; commits?: string[]; note?: string };

export type UntrackedFiles = { paths: string[]; unreadablePaths: string[] };

export type TreeStatus = {
    staged: string[];
    unstaged: string[];
    untracked: UntrackedFiles;
    hasStagedChanges: boolean;
};

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type GitEnvironment = { variables: Record<string, string | undefined> } | { failure: SpawnResult };

export type GitRepository = { folder: string; environment: Record<string, string | undefined> };

export type GitLookup = GitRepository | { failure: SpawnResult };

export type GitVariableGroups = {
    isolated: Record<string, undefined>;
    overrides: Record<string, string | undefined>;
};
