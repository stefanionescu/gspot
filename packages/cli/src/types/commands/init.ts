import type { z } from 'zod';
import { type Session } from '#cli/types/session.ts';
import { type TomlTable } from '#cli/types/settings/file.ts';
import { type FileContents } from '#cli/types/system/files.ts';
import { type RepositorySetup } from '#cli/types/repository/setup.ts';
import type { prettierSettingsSchema } from '#cli/schemas/commands.ts';
import { type AvailableSettings } from '#cli/types/settings/inheritance.ts';
import { type ConfigurationEvidence } from '#cli/types/repository/detect.ts';
import { type Level, type Configuration } from '#cli/types/configurations.ts';
import { type Generation, type ApplyReport } from '#cli/types/generation/files.ts';
import { type Repository, type ScopeFolder, type TrackedFile } from '#cli/types/repository/files.ts';

export type InitScan = {
    template?: Template | undefined;
    repository: Repository;
    repositorySetup: RepositorySetup;
    configurations: InitConfigurations;
    everySelected: Configuration[];
    conflicts: ConflictingConfigFiles;
};

export type InitPlan = {
    template?: { file: string; leftOut: LeftOutSetting[] };
    level: Level;
    configurations: { configuration: string; origin: ConfigurationOrigin; checks: number; checksOff: number }[];
    write: InitFileRow[];
    delete: InitFileRow[];
    keep: InitFileRow[];
    change: InitFileRow[];
    lintFolders: InitFileRow[];
};

export type ConflictingConfigFiles = {
    changed: InitFileRow[];
    reviewed: Map<string, FileContents | undefined>;
    deleted: InitFileRow[];
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

export type InitJson = { root: string; plan: InitPlan; settings: string } & ApplyReport;

export type DetectionSummary = {
    files: TrackedFile[];
    detected: ConfigurationEvidence[];
    scopes: ScopeFolder[];
    repositorySetup: RepositorySetup;
    owned: string[];
    unowned: string[];
    configurationsByName: Map<string, Configuration>;
    hasGit: boolean;
};

export type InitFileRow = { path: string; note: string };

export type InitOptions = {
    template?: Template | undefined;
    cwd: string;
    yes: boolean;
    level?: Level | undefined;
    configurations?: string[] | undefined;
};

export type ConfigurationOrigin = 'named' | 'template' | 'detected' | 'suggested' | 'required' | 'always';

export type InitConfigurations = {
    scopes: ScopeFolder[];
    rootNames: string[];
    scopeConfigurations: Map<string, string[]>;
    detected: ConfigurationEvidence[];
    origins: Map<string, ConfigurationOrigin>;
};

export type InitRepository = {
    repository: Repository;
    configurationsByName: Map<string, Configuration>;
    options: Pick<InitOptions, 'configurations' | 'template'>;
};

export type ConfigurationChoices = {
    template: Set<string>;
    named: Set<string>;
    detected: Set<string>;
    written: Set<string>;
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
