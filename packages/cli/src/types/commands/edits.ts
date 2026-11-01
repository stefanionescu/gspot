import type { z } from 'zod';
import type { ApplyReport } from '#cli/types/generation.ts';
import type { Session, Generation } from '#cli/types/tools.ts';
import type { COMMAND_HELP } from '#cli/config/commands/help.ts';
import type { Setting, Configuration } from '#cli/types/manifests.ts';
import type { prettierSettingsSchema } from '#cli/schemas/commands.ts';
import type { IMPORT_EXTENSION_STYLES } from '#cli/config/settings/schema.ts';
import type { RunCache, FileContents, CommandResult } from '#cli/types/system.ts';

import type {
    Level,
    Settings,
    TomlTable,
    SettingsEdit,
    InheritedSetting,
    AvailableSettings,
} from '#cli/types/settings.ts';
import type {
    Repository,
    ScopeFolder,
    TrackedFile,
    RepositorySetup,
    RepositoryListing,
    InitConfigurations,
    ConfigurationOrigin,
    ConfigurationEvidence,
} from '#cli/types/repository.ts';

export type CommandLocation = { readonly root: string; readonly cwd: string };

export type CommandArgument = { term: string; choices?: readonly string[]; defaultValue?: string };

export type CommandOption = {
    flags: string;
    choices?: readonly string[];
    required?: boolean;
    parse?: (value: string, previous: string[] | undefined) => unknown;
};

export type CommandDefinition<Arguments extends readonly unknown[] = readonly unknown[], Flags = object> = {
    name: keyof typeof COMMAND_HELP;
    arguments?: readonly CommandArgument[];
    options?: readonly CommandOption[];
    run(args: Arguments, flags: Flags, location: CommandLocation): Promise<CommandResult<object>>;
};

export type CommandHelp = {
    summary: string;
    group: string;
    description: string;
    arguments: Readonly<Record<string, string>>;
    options: Readonly<Record<string, string>>;
    exitCodes: readonly (readonly [string, string])[];
    example: string;
};

export type ScopeFlags = { scope?: string | undefined };

export type ReasonFlags = ScopeFlags & { reason?: string | undefined };

export type IgnoreFlags = { reason: string; rule?: string | undefined; paths?: string[] | undefined };

export type InitFlags = { from?: string; configurations?: string[] | false; level?: Level };

export type IgnoreOptions = {
    root: string;
    cwd: string;
    check?: string | undefined;
    paths?: string[] | undefined;
    rule?: string | undefined;
    reason: string;
};

export type InstallCommandJson = {
    summary: string;
    installed: string[];
    steps: readonly (readonly string[])[];
    notes: string[];
};

export type SetOptions = {
    root: string;
    cwd: string;
    key: string;
    values: string[];
    reason?: string | undefined;
    scope?: string | undefined;
};

export type ParsedSettingValue = { type: 'list'; value: unknown[] } | { type: 'scalar'; value: unknown };

export type SettingReasonContext = {
    options: SetOptions;
    setting: Setting;
    change: ParsedSettingValue;
    joined: unknown;
    previous: InheritedSetting | undefined;
    shippedDefault: unknown;
};

export type IgnoreRemoval = {
    kept: unknown[];
    deleted: number;
    changedIgnores: number;
    removedPaths: number;
    everywhere: number;
};

export type IgnoreTarget = { unmatched: string; removed: string };

export type UnsetOptions = { root: string; cwd: string; key: string; keys: string[]; scope?: string | undefined };

export type InitScan = {
    template?: Template | undefined;
    repository: Repository;
    repositorySetup: RepositorySetup;
    configurations: InitConfigurations;
    everySelected: Configuration[];
    conflicts: ConflictingConfigs;
};

export type InitPlan = {
    from?: { file: string; leftOut: LeftOutSetting[] };
    level: Level;
    configurations: { configuration: string; origin: ConfigurationOrigin; checks: number; checksOff: number }[];
    write: InitFileRow[];
    delete: InitFileRow[];
    keep: InitFileRow[];
    change: InitFileRow[];
    lintFolders: InitFileRow[];
};

export type ConflictingConfigs = {
    changed: InitFileRow[];
    reviewed: Map<string, FileContents | undefined>;
    deleted: { path: string; tool: string; unreadablePrettier: boolean }[];
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
};

export type InitJson = { root: string; plan: InitPlan; settingsText: string } & ApplyReport;

export type DetectionSummary = {
    files: TrackedFile[];
    detected: ConfigurationEvidence[];
    scopes: ScopeFolder[];
    repositorySetup: RepositorySetup;
    owned: string[];
    unowned: string[];
    configurationsByName: Map<string, Configuration>;
};

export type InitFileRow = { path: string; note: string };

export type InitOptions = {
    template?: Template | undefined;
    cwd: string;
    level?: Level | undefined;
    configurations?: string[] | undefined;
};

export type PrettierOptions = z.infer<typeof prettierSettingsSchema>;

export type ScopeConfigurations = { scope: string; selected: Configuration[] };

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

export type ConfigurationsOptions = { root: string; cwd: string; configurations: string[]; scope?: string | undefined };

export type ConfigurationChange = {
    action: string;
    changed: string[];
    where: string;
    unchanged: string[];
    state: string;
};

export type SettingsEditContext = {
    root: string;
    edit: SettingsEdit;
    settings: Settings;
    cache: RunCache;
    session: Session;
    listing: RepositoryListing;
    scope: string;
    scopeTable: TomlTable;
};

export type SettingsEditOptions = {
    edit: SettingsEdit;
    summary: string;
    unchangedSummary?: string;
    notes?: string[];
    cache?: RunCache | undefined;
    listing?: RepositoryListing | undefined;
};

export type ImportExtensionStyle = (typeof IMPORT_EXTENSION_STYLES)[number];

export type CommandCompletion = (result: CommandResult<object>) => void;
