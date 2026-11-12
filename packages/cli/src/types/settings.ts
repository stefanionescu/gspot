import type { z } from 'zod';

import type { LEVELS, SETTING_LANGUAGES } from '#cli/config/manifests.ts';
import type { IMPORT_EXTENSION_STYLES, NAMING_TABLE_CATEGORIES } from '#cli/config/settings/schema.ts';
import type { tableValuesSchema } from '#cli/schemas/settings/configurations.ts';
import type { removedConfigurationSchema, settingOriginSchema } from '#cli/schemas/settings/fields.ts';
import type { settingsSchema } from '#cli/schemas/settings/file.ts';
import type { limitFields } from '#cli/schemas/settings/limits.ts';
import type { importRulesSchema } from '#cli/schemas/settings/tables.ts';
import type { toolsSchema } from '#cli/schemas/settings/tools.ts';
import type { Check, Configuration, Setting } from '#cli/types/manifests.ts';
import type { KeyPath, TomlSyntax } from '#cli/types/parsers.ts';
import type { Repository, ScopeFolder } from '#cli/types/repository.ts';
import type { FileContents } from '#cli/types/system.ts';

export type Level = (typeof LEVELS)[number];

export type ImportExtensionStyle = (typeof IMPORT_EXTENSION_STYLES)[number];

export type ScopeConfigurations = { scopePath: string; selected: Configuration[] };

export type DetectedScopes = { repository: Repository; scopes: ReadonlyArray<{ path: string }> };

export type SettingVariant = { setting: Setting; owners: string[] };

export type AcceptedSettingValues = {
    types: string[];
    choices: Array<{ value: unknown; description: string | undefined }>;
    alternatives: AcceptedSettingValues[];
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
    accepted: AcceptedSettingValues;
    variants: SettingVariant[];
    children: SettingReference[];
};

export type SettingsFile = { text: string; table: TomlTable; previous: FileContents };

export type EditedSettings = { text: string; settings: Settings; changed: boolean };

export type SettingKey = { path: string[]; name: string };

export type RemovedConfiguration = z.infer<typeof removedConfigurationSchema>;

export type SelectedConfigurations = Pick<ParsedSettings, 'configurations' | 'removed_configurations'> & {
    scopes: Map<string, Pick<ParsedSettings, 'configurations' | 'removed_configurations'>>;
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
    ignores: IgnoreRecord[];
};

export type InheritedSetting = {
    key: string;
    setting: Setting;
    value: unknown;
    reason?: string | undefined;
    origin: SettingOrigin;
    /**
    The written key that set the value, when it differs from `key`.
    */
    writtenAs?: string;
};

export type SettingOrigin = z.infer<typeof settingOriginSchema>;

export type InheritedValue = Pick<InheritedSetting, 'value' | 'origin' | 'writtenAs'> & {
    reason: string | undefined;
};

export type AvailableSettings = {
    settings: Map<string, Setting>;
    defaults: Map<string, SettingDefault>;
    errors: Array<{ key: string; message: string }>;
};

export type SettingMatch = { setting: Setting; language?: string; category?: string };

export type WrittenSetting = Pick<InheritedSetting, 'value' | 'reason'>;

export type WrittenScopeTable = { table: SettingsTable; scopePath: string; path: KeyPath };

export type SettingDefault = { value: unknown; configuration: string };

export type SettingLocation = { keys: KeyPath; names: string[] };

export type PathVisitor = (path: string, location: SettingLocation, role: NonNullable<Setting['path_role']>) => string;

type SettingLanguage = (typeof SETTING_LANGUAGES)[number];

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
    structure: StructureSettings;
    tools: ParsedTools;
    ignore: IgnoreRecord[];
    commandChecks: Record<string, CommandCheck>;
    hooks: Defined<Required<ParsedSettings['hooks']>>;
    ci?: ParsedSettings['ci'];
    scopes: Map<string, NonNullable<ParsedSettings['scope']>[number] & Pick<Settings, 'written'>>;
};

type CommandCheck = Check & {
    command: string[];
    files: NonNullable<Check['files']>;
};

export type SettingsTable = Settings | NonNullable<ReturnType<Settings['scopes']['get']>>;

export type ParsedSettings = z.output<typeof settingsSchema>;

export type WrittenSettings = z.input<typeof settingsSchema>;

export type IgnoreRecord = NonNullable<ParsedSettings['ignore']>[number];

export type SettingsError = { path: KeyPath; message: string };

export type SettingsFailure = { errors: SettingsError[]; syntax: TomlSyntax };

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
