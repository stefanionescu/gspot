import type { z } from 'zod';
import type { KeyPath } from '#cli/types/parsers.ts';
import type { FileContents } from '#cli/types/system.ts';
import type { ScopeFolder } from '#cli/types/repository.ts';
import type { limitFields } from '#cli/schemas/settings/limits.ts';
import type { settingsSchema } from '#cli/schemas/settings/file.ts';
import type { tableValuesSchema } from '#cli/schemas/settings/tables.ts';
import type { toolsSchema } from '#cli/schemas/settings/tools/tables.ts';
import type { LEVELS, SETTING_LANGUAGES } from '#cli/config/manifests.ts';
import type { importRulesSchema } from '#cli/schemas/settings/settings.ts';
import type { LEFT_OUT_NOTES, NAMING_TABLE_CATEGORIES } from '#cli/config/settings/schema.ts';
import type { Check, Setting, Configuration, ReasonRequirement } from '#cli/types/manifests.ts';

export type Level = (typeof LEVELS)[number];

export type SettingVariant = { setting: Setting; owners: string[] };

export type SettingAccepted = {
    types: string[];
    choices: { value: unknown; description: string | undefined }[];
    alternatives: SettingAccepted[];
};

export type SettingReference = {
    key: string;
    name: string;
    kind: 'value' | 'table' | 'record';
    required: boolean;
    description: string | undefined;
    default: unknown;
    reasoned: boolean;
    variantOf: string | undefined;
    rootOnly: boolean;
    scopeKeys: string[];
    accepted: SettingAccepted;
    variants: SettingVariant[];
    children: SettingReference[];
};

export type ReasonedSettingDefinition = SettingDefinition &
    Required<Pick<SettingDefinition, 'description' | 'reason_when'>>;

export type SettingDefinition = {
    template?: keyof typeof LEFT_OUT_NOTES;
    description?: string;
    minimum?: number;
    maximum?: number;
    configurations?: readonly string[];
    reason_when?: ReasonRequirement;
    reason_values?: boolean;
    languages?: readonly string[];
    language_defaults?: Readonly<Record<string, unknown>>;
    default_all?: unknown;
    default?: unknown;
};

export type SettingsEdit = { text: string; table: TomlTable; previous: FileContents };

export type EditedSettings = { text: string; settings: Settings; changed: boolean };

export type SettingKey = { path: string[]; name: string };

export type RemovedConfiguration = { name: string; scope: string; reason: string };

export type SelectedConfigurations = {
    configurations: string[];
    scopes: Map<string, { configurations: string[]; removed_configurations: string[] }>;
    removed_configurations: string[];
};

export type Scope = {
    path: string;
    origin: ScopeFolder['origin'];
    configurations: Configuration[];
    availableSettings: AvailableSettings;
    settings: ScopeSettings;
};

export type ScopeSettings = {
    configurations: string[];
    test_files: Settings['test_files'];
    valuesByKey: Record<string, unknown>;
    tables: TableValues;
    ignores: (IgnoreRecord & { paths: string[] })[];
};

export type InheritedSetting = {
    key: string;
    setting: Setting;
    value: unknown;
    reason?: string | undefined;
    source: string;
    origin: 'root' | 'scope' | 'configuration' | 'unset';
    originScope?: string | undefined;
};

export type InheritedValue = Pick<InheritedSetting, 'value' | 'source' | 'origin' | 'originScope'> & {
    reason: string | undefined;
};

export type AvailableSettings = {
    settings: Map<string, Setting>;
    defaults: Map<string, SettingDefault>;
    errors: { key: string; message: string }[];
};

export type SettingMatch = { setting: Setting; language?: string; category?: string };

export type WrittenSetting = Pick<InheritedSetting, 'value' | 'reason'>;

export type WrittenScopeTable = { table: SettingsTable; scope: string; path: KeyPath };

export type SettingDefault = { value: unknown; configuration: string };

export type PathVisitor = (path: string, keys: KeyPath, role: NonNullable<Setting['path_role']>) => string;

export type SettingLanguage = (typeof SETTING_LANGUAGES)[number];

export type NamingCategory = (typeof NAMING_TABLE_CATEGORIES)[number];

export type TableValues = z.output<typeof tableValuesSchema>;

export type TableSettings<Name extends keyof TableValues> = NonNullable<TableValues[Name]>;

type StructureSettings = Defined<Required<NonNullable<ParsedSettings['structure']>>>;

export type Settings = Omit<
    ParsedSettings,
    'scope' | 'command_check' | 'tools' | 'structure' | 'hooks' | 'ci' | 'ignore'
> & {
    written: TomlTable;
    level: NonNullable<ParsedSettings['level']>;
    configurations: string[];
    removed_configurations: string[];
    structure: StructureSettings;
    tools: ParsedTools;
    test_files: string[];
    ignore: IgnoreRecord[];
    commandChecks: Record<string, CommandCheck>;
    hooks?: Defined<Required<NonNullable<ParsedSettings['hooks']>>> | undefined;
    ci?: ParsedSettings['ci'];
    scopes: Map<string, NonNullable<ParsedSettings['scope']>[number] & Pick<Settings, 'written'>>;
};

export type CommandCheck = Check & {
    command: string[];
    files: NonNullable<Check['files']>;
};

export type SettingsTable = Settings | NonNullable<ReturnType<Settings['scopes']['get']>>;

export type ParsedSettings = z.output<typeof settingsSchema>;

export type IgnoreRecord = NonNullable<ParsedSettings['ignore']>[number];

export type SettingsError = { path: KeyPath; message: string };

export type TomlTable = Record<string, unknown>;

export type ImportRule = z.output<typeof importRulesSchema>[number];

export type TaploLayout = { width: number; indent: string };

export type ToolTableSchemas = {
    [Tool in keyof typeof toolsSchema.shape as `tools.${Tool}`]: (typeof toolsSchema.shape)[Tool];
};

type ParsedTools = z.output<typeof toolsSchema>;

export type ReasonedValue<Value> = { value: Value; reason: string };

export type LanguageLimitField = {
    [Field in keyof typeof limitFields]: z.ZodOptional<(typeof limitFields)[Field]>;
};

export type LanguageLimitSchemas = {
    [Language in SettingLanguage]: z.ZodOptional<z.ZodObject<LanguageLimitField>>;
};

export type Defined<Value> = { [Key in keyof Value]: Exclude<Value[Key], undefined> };
