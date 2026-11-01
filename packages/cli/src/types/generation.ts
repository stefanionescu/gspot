import type { z } from 'zod';
import type { Tool, Configuration } from '#cli/types/manifests.ts';
import type { ConfigTargets } from '#cli/types/engine/tool-runs.ts';
import type { TextRange, FileContents } from '#cli/types/system.ts';
import type { prettierSettingsSchema } from '#cli/schemas/generation.ts';
import type { OwnedConfig } from '#cli/types/configurations/language.ts';
import type { FROZEN_INSTALLS } from '#cli/config/repository/javascript.ts';
import type { Session, Generation, GeneratedFile } from '#cli/types/tools.ts';
import type { SourcedConfig, IgnoreSection } from '#cli/types/configurations/general.ts';
import type { Level, Scope, Settings, TomlTable, AvailableSettings } from '#cli/types/settings.ts';

import type {
    Repository,
    ScopeFolder,
    TrackedFile,
    PackageManager,
    RepositorySetup,
    PackageManagerPin,
    InitConfigurations,
    ConfigurationOrigin,
    ConfigurationEvidence,
} from '#cli/types/repository.ts';

export type PlannedLinkField = {
    scope: Scope;
    configuration: Configuration;
    tool: Tool;
    consumed: boolean;
    paths: ReadonlySet<string>;
    configs: ConfigTargets;
    scopePaths: string[];
};

export type OwnedSourceFile = OwnedConfig & { config: SourcedConfig };

export type BuiltConfig = OwnedSourceFile & {
    file: GeneratedFile;
    companions: GeneratedFile[];
};

export type ConfigBuildState = {
    ignoreSections: IgnoreSection[];
    targets: Map<string, Map<string, string>>;
    files: Map<string, GeneratedFile>;
    failures: Map<string, Map<string, Error>>;
};

export type UsedNames = { tools: Set<string>; checks: Set<string> };

export type ApplyReport = {
    written: string[];
    unchanged: string[];
    removed: string[];
    updated: string[];
    notes: string[];
};

export type ActionPin = { name: string; sha: string; version: string };

export type GithubJobPurpose = { condition: string; lastStep: Record<string, unknown> };

export type Pipeline = {
    version: string;
    packageManager?: PackageManagerPin | undefined;
    packageManagers: CiPackageManager[];
    setupCommand?: NonNullable<Settings['ci']>['setup_command'];
    projectInstall: string[];
    operatingSystems: NonNullable<Settings['ci']>['operating_systems'];
    linuxRunner: NonNullable<Settings['ci']>['linux_runner'];
    lockfiles: string[];
    testChecks: string[];
};

export type FrozenLockfile = keyof typeof FROZEN_INSTALLS;

export type CiPackageManager = (typeof FROZEN_INSTALLS)[FrozenLockfile][0];

export type RuleFile = {
    path: string;
    target: string;
    content: string;
    scopes: string[];
    group: Configuration['group'];
};

export type AgentsBlockContent = {
    files: RuleFile[];
    managedKeys: { path: string; keys: string[] }[];
    startCommand: string;
    hasOwnTitle: boolean;
};

export type RuleSection = {
    start: number;
    end: number;
    depth: number;
    marker: TextRange | undefined;
};

export type InitScan = {
    template?: Template | undefined;
    repository: Repository;
    repositorySetup: RepositorySetup;
    configurations: InitConfigurations;
    scopes: Pick<Scope, 'path' | 'configurations'>[];
    everySelected: Configuration[];
    conflicts: ConflictingConfigs;
    pinPath?: string | undefined;
};

export type InitPlan = {
    from?: { file: string; leftOut: LeftOutSetting[] };
    level: Level;
    configurations: {
        configuration: string;
        origin: ConfigurationOrigin;
        scopes: string[];
        checks: number;
        checksOff: number;
    }[];
    write: InitFileRow[];
    delete: InitFileRow[];
    keep: InitFileRow[];
    change: InitFileRow[];
    lintFolders: InitFileRow[];
};

export type ConflictingConfigs = {
    changed: InitFileRow[];
    reviewed: Map<string, FileContents | undefined>;
    deleted: { path: string; tool: string; unreadablePrettier: boolean; dropsLineEndings: boolean }[];
    kept: InitFileRow[];
};

export type SettingsDraft = {
    template?: Template | undefined;
    base: string;
    level?: Level | undefined;
    configurations: string[];
    scopes: ScopeFolder[];
};

export type InitPlanning = {
    detection: DetectionSummary;
    session: Session;
    generated: Generation;
    plan: InitPlan;
    settingsText: string;
    reviewed: Map<string, FileContents | undefined>;
    replaced: string[];
    pinPath: string | undefined;
};

export type DetectionSummary = {
    files: TrackedFile[];
    detected: ConfigurationEvidence[];
    scopes: ScopeFolder[];
    repositorySetup: RepositorySetup;
    owned: string[];
    unowned: string[];
    configurationsByName: ReadonlyMap<string, Configuration>;
};

export type InitFileRow = { path: string; note: string };

export type InitOptions = {
    template?: Template | undefined;
    cwd: string;
    level?: Level | undefined;
    configurations?: string[] | undefined;
};

export type PrettierOptions = z.infer<typeof prettierSettingsSchema>;

export type WrittenTable = { scope: string; table: TomlTable; availableSettings: AvailableSettings };

export type EditorconfigSection = { files: string; fields: Record<string, string> };

export type Template = {
    file: string;
    text: string;
    table: TomlTable;
    configurations: string[];
    removed: string[];
    leftOut: LeftOutSetting[];
};

export type LeftOutSetting = { key: string; note: string };
