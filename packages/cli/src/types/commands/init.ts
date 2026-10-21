import type { Session } from '#cli/types/session.ts';
import type { Settings } from '#cli/types/settings/file.ts';
import type { GenerationResult } from '#cli/types/generation/files.ts';
import type { Level, Configuration } from '#cli/types/configurations.ts';
import type { ExistingTools } from '#cli/types/repository/existing-tools.ts';
import { type ReadCache, type FileContents } from '#cli/types/system/files.ts';
import type { ConfigurationEvidence } from '#cli/types/repository/detection.ts';
import type { Repository, ScopeFolder, TrackedFile } from '#cli/types/repository/inventory.ts';

export type InitScan = {
    reads: ReadCache;
    repository: Repository;
    options: InitOptions;
    existingTools: ExistingTools;
    configurations: InitConfigurations;
    everySelected: Configuration[];
    answers: InitAnswers;
    replaced: ReplacedFiles;
    foreignDisableComments: InitFileRow[];
};

export type InitPlan = {
    level: Level;
    configurations: { configuration: string; origin: ConfigurationOrigin; checks: number; checksOff: number }[];
    write: InitFileRow[];
    delete: InitFileRow[];
    retained: InitFileRow[];
    change: InitFileRow[];
    noLongerRuns: InitFileRow[];
};

/** The authored tool files that init replaces: what it read, what it deletes, and what stays for you. */
export type ReplacedFiles = {
    changed: InitFileRow[];
    read: Map<string, FileContents | undefined>;
    deleted: InitFileRow[];
    retained: InitFileRow[];
};

export type SettingsDraft = InitAnswers & {
    level?: Level;
    configurations: string[];
    scopes: ScopeFolder[];
};

/** The integration choices init uses. */
export type InitAnswers = {
    hooks: boolean;
    ci: NonNullable<Settings['ci']>['provider'] | 'none';
    rules: boolean;
};

/** Everything init computes before it asks to continue. */
export type InitPrepared = {
    detection: DetectionSummary;
    session: Session;
    generated: GenerationResult;
    plan: InitPlan;
    settingsText: string;
    deleted: { path: string }[];
    read: Map<string, FileContents | undefined>;
};

/** The JSON the init command prints: the plan and the settings it wrote or showed in a dry run. */
export type InitJson = { root: string; plan: InitPlan; settings: string; written: boolean };

export type DetectionSummary = {
    files: TrackedFile[];
    detected: ConfigurationEvidence[];
    scopes: ScopeFolder[];
    existingTools: ExistingTools;
    owned: string[];
    unowned: string[];
    configurations: Map<string, Configuration>;
    hasGit: boolean;
};

/** A file that init writes, removes, or keeps, with its note. */
export type InitFileRow = { path: string; note: string };

export type InitOptions = {
    cwd: string;
    yes: boolean;
    isDryRun: boolean;
    level?: Level;
    configurations?: string[];
};

export type ConfigurationOrigin = 'named' | 'detected' | 'suggested' | 'required';

/** The configurations init selects: at the root, per scope, and the closure of both. */
export type InitConfigurations = {
    scopes: ScopeFolder[];
    rootNames: string[];
    scopeConfigurations: Map<string, string[]>;
    selectedNames: Set<string>;
    detected: ConfigurationEvidence[];
    origins: Map<string, ConfigurationOrigin>;
};

/** The inputs to init selection. */
export type InitRepository = {
    repository: Repository;
    configurations: Map<string, Configuration>;
    options: Pick<InitOptions, 'configurations'>;
};

/** Explicit, detected, and recommended choices, to explain the init selection. */
export type ConfigurationChoices = { named: Set<string>; detected: Set<string>; written: Set<string> };

export type PrettierOptions = {
    tabWidth?: number | undefined;
    printWidth?: number | undefined;
    singleQuote?: boolean | undefined;
    overrides?: { files: string | string[]; options: Omit<PrettierOptions, 'overrides'> }[] | undefined;
};

type RuffFormatOptions = { 'quote-style'?: string | undefined };

export type RuffFormatSettings = {
    format?: RuffFormatOptions | undefined;
    tool?: { ruff?: { format?: RuffFormatOptions | undefined } | undefined } | undefined;
};
