import type { Session } from '#cli/types/planning.ts';
import type { Settings } from '#cli/types/settings/values.ts';
import type { Level, Manifest } from '#cli/types/configurations.ts';
import type { GenerationResult } from '#cli/types/generation/files.ts';
import { type ReadCache, type FileContents } from '#cli/types/system/files.ts';
import type { ConfigurationEvidence } from '#cli/types/repository/selection.ts';
import type { Scope, Repository, TrackedFile, ExistingTools } from '#cli/types/repository/inventory.ts';

type InitPlanInputs = {
    reads: ReadCache;
    repository: Repository;
    options: InitOptions;
    existingTools: ExistingTools;
    selection: InitSelection;
    everySelected: Manifest[];
    answers: InitAnswers;
    replaced: ReplacedFiles;
    foreignDisableComments: InitFileRow[];
};

type InitPlan = {
    level: Level;
    configurations: { configuration: string; how: ConfigurationReason; checks: number; checksOff: number }[];
    write: InitFileRow[];
    delete: InitFileRow[];
    retained: InitFileRow[];
    change: InitFileRow[];
    noLongerRuns: InitFileRow[];
};

/** The authored tool files that init replaces: what it read, what it deletes, and what stays for you. */
type ReplacedFiles = {
    changed: InitFileRow[];
    read: Map<string, FileContents | undefined>;
    deleted: InitFileRow[];
    retained: InitFileRow[];
};

type SettingsDraft = InitAnswers & {
    level?: Level;
    configurations: string[];
    scopes: Scope[];
};

/** The integration choices init uses. */
type InitAnswers = {
    hooks: boolean;
    ci: CiChoice;
    rules: boolean;
};

/** Everything init computes before it asks to continue. */
type InitPrepared = {
    detection: DetectionSummary;
    session: Session;
    generated: GenerationResult;
    plan: InitPlan;
    settingsText: string;
    deleted: { path: string }[];
    read: Map<string, FileContents | undefined>;
};

/** The JSON the init command prints: the plan and the settings it wrote or showed in a dry run. */
type InitJson = { root: string; plan: InitPlan; settings: string; written: boolean };

type DetectionSummary = {
    files: TrackedFile[];
    detected: ConfigurationEvidence[];
    scopes: Scope[];
    existingTools: ExistingTools;
    owned: string[];
    unowned: string[];
    manifests: Map<string, Manifest>;
    hasGit: boolean;
};

/** A file that init writes, removes, or keeps, with its note. */
type InitFileRow = { path: string; note: string };

/** The CI provider init selects, including an explicit choice to write no workflow. */
type CiChoice = NonNullable<Settings['ci']>['provider'] | 'none';

type InitOptions = {
    cwd: string;
    yes: boolean;
    isDryRun: boolean;
    level?: Level;
    configurations?: string[];
};

type ConfigurationReason = 'named' | 'detected' | 'suggested' | 'required';

/** The configurations init selects: at the root, per scope, and the closure of both. */
type InitSelection = {
    scopes: Scope[];
    rootIds: string[];
    scopeConfigurations: Map<string, string[]>;
    selectedIds: Set<string>;
    detected: ConfigurationEvidence[];
    how: Map<string, ConfigurationReason>;
};

/** The inputs to init selection. */
type InitInputs = {
    repository: Repository;
    manifests: Map<string, Manifest>;
    options: Pick<InitOptions, 'configurations'>;
};

/** Explicit, detected, and recommended choices, to explain the init selection. */
type ConfigurationChoices = { named: Set<string>; chosen: Set<string>; listed: Set<string> };

type InitFormatOptions = {
    tabWidth?: number | undefined;
    printWidth?: number | undefined;
    singleQuote?: boolean | undefined;
    overrides?: { files: string | string[]; options: Omit<InitFormatOptions, 'overrides'> }[] | undefined;
};

type RuffFormatOptions = { 'quote-style'?: string | undefined };

type RuffFormatSettings = {
    format?: RuffFormatOptions | undefined;
    tool?: { ruff?: { format?: RuffFormatOptions | undefined } | undefined } | undefined;
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
    InitSelection,
    InitPlanInputs,
    DetectionSummary,
    InitFormatOptions,
    RuffFormatSettings,
    ConfigurationReason,
    ConfigurationChoices,
};
