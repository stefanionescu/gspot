import type { Session } from '#cli/types/planning.ts';
import type { FileCopy } from '#cli/types/system/files.ts';
import type { Template } from '#cli/types/settings/file.ts';
import type { Settings } from '#cli/types/settings/values.ts';
import type { Generated } from '#cli/types/generation/files.ts';
import type { Level, Manifest } from '#cli/types/configurations.ts';
import type { DependencyFile } from '#cli/types/parsers/dependency-files.ts';
import type { ConfigurationEvidence } from '#cli/types/repository/selection.ts';
import type { Tooling, Repository, ScopeEntry, TrackedFile } from '#cli/types/repository/inventory.ts';

type InitPlanInputs = {
    root: string;
    hasGit: boolean;
    index: Repository['index'];
    options: InitOptions;
    tooling: Tooling;
    selection: InitSelection;
    everySelected: Manifest[];
    answers: InitAnswers;
    replaced: ReplacedFiles;
};

type InitPlan = {
    level: Level;
    template?: { source: string; digest: string; detected: string[] };
    configurations: { configuration: string; how: ConfigurationReason; checks: number; checksOff: number }[];
    write: InitFileRow[];
    delete: InitFileRow[];
    retained: InitFileRow[];
    change: InitFileRow[];
    noLongerRuns: InitFileRow[];
};

/** The authored configuration init replaces: what it read, what it deletes, and what stays for the developer. */
type ReplacedFiles = {
    changed: InitFileRow[];
    read: Map<string, FileCopy | undefined>;
    deleted: InitFileRow[];
    retained: InitFileRow[];
};

type SettingsDraft = InitAnswers & {
    template?: Template;
    configurations: string[];
    scopes: ScopeEntry[];
    commitScopes?: string[];
};

/** The defaults or template values init uses. */
type InitAnswers = {
    hooks: boolean;
    ci: CiChoice;
    rules: boolean;
};

/** Everything init computes before it asks to continue. */
type InitPrepared = {
    session: Session;
    generated: Generated;
    plan: InitPlan;
    settingsText: string;
    deleted: { path: string }[];
    read: Map<string, FileCopy | undefined>;
};

/** The JSON the init command prints: the plan and the settings it wrote or showed in a dry run. */
type InitJson = {
    root?: string;
    plan?: InitPlan;
    settings?: string;
    dryRun?: boolean;
    written?: boolean;
};

type DetectionSummary = {
    files: TrackedFile[];
    detected: ConfigurationEvidence[];
    scopes: ScopeEntry[];
    tooling: Tooling;
    owned: string[];
    unowned: string[];
    manifests: Map<string, Manifest>;
    hasGit: boolean;
};

/** A file initialization writes, removes, or preserves, with its explanation. */
type InitFileRow = { path: string; note: string };

/** The CI provider init selects, including an explicit choice to write no workflow. */
type CiChoice = NonNullable<Settings['ci']>['provider'] | 'none';

type InitOptions = {
    cwd: string;
    yes: boolean;
    isDryRun: boolean;
    configurations?: string[];
    from?: string;
    template?: Template;
};

type ConfigurationReason = 'named' | 'detected' | 'suggested' | 'required';

/** What init selection reads. */
type InitDetection = {
    root: string;
    manifests: Map<string, Manifest>;
    files: TrackedFile[];
    packageManifests: DependencyFile[];
    options: Pick<InitOptions, 'configurations' | 'template'>;
    /** Whether the folder contains a Git repository; a configuration whose checks all read git stays out otherwise. */
    hasGit: boolean;
};

/** The configurations init selects: at the root, per scope, and the closure of both. */
type InitSelection = {
    scopes: ScopeEntry[];
    rootIds: string[];
    scopeConfigurations: Map<string, string[]>;
    selectedIds: Set<string>;
    detected: ConfigurationEvidence[];
    how: Map<string, ConfigurationReason>;
};

/** The inputs to init selection. */
type InitInputs = {
    root: string;
    repo: Repository;
    packageManifests: DependencyFile[];
    scopes: ScopeEntry[];
    manifests: Map<string, Manifest>;
    options: Pick<InitOptions, 'configurations' | 'template'>;
};

/** Explicit, detected, and recommended choices for explaining initial selection. */
type ConfigurationChoices = { named: Set<string>; chosen: Set<string>; listed: Set<string> };

type InitFormatOptions = {
    tabWidth?: number | undefined;
    printWidth?: number | undefined;
    singleQuote?: boolean | undefined;
};

export type {
    InitPlan,
    InitJson,
    InitInputs,
    InitAnswers,
    InitFileRow,
    InitOptions,
    InitPrepared,
    ReplacedFiles,
    SettingsDraft,
    InitDetection,
    InitSelection,
    InitPlanInputs,
    DetectionSummary,
    InitFormatOptions,
    ConfigurationReason,
    ConfigurationChoices,
};
