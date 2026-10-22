import type { PATH_ROLES } from '#cli/config/settings/known.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import type { ScopeFolder } from '#cli/types/repository/files.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import type { ReasonNeeded } from '#cli/types/settings/definitions.ts';
import type { SETTING_TYPES } from '#cli/config/settings/inheritance.ts';
import type { Settings, TableValues, IgnoreRecord, SettingsTable } from '#cli/types/settings/file.ts';

/** Configuration choices declared at the root and in project scopes. */
export type SelectedConfigurations = {
    configurations: string[];
    scopes: Record<string, { configurations: string[]; removed_configurations: string[] }>;
    removed_configurations: string[];
};

export type Setting = {
    name: string;
    type: (typeof SETTING_TYPES)[number];
    path_role?: (typeof PATH_ROLES)[number];
    default?: unknown;
    default_all?: unknown;
    language_defaults?: Record<string, unknown>;
    reason_needed?: ReasonNeeded;
    reason_values?: boolean;
    description: string;
    languages?: string[];
    categories?: string[];
};

export type Scope = {
    folder: ScopeFolder;
    configurations: Configuration[];
    knownSettings: KnownSettings;
    settings: ScopeSettings;
};

/** Values that gspot validates once for one scope, and that checks and generators then read. */
export type ScopeValues = {
    settings: Record<string, unknown>;
    values: TableValues;
    test_files: Settings['test_files'];
};

export type ScopeSettings = {
    configurations: string[];
    test_files: Settings['test_files'];
    settings: Record<string, unknown>;
    values: TableValues;
    ignores: (IgnoreRecord & { paths: string[] })[];
};

export type EffectiveSetting = {
    key: string;
    setting: Setting;
    value: unknown;
    reason?: string;
    source: string;
    origin: 'root' | 'scope' | 'configuration' | 'unset';
    originScope?: string;
    scope?: string;
};

/** Where a resolved value stands after the reader applies some tables. */
export type EffectiveValue = Pick<EffectiveSetting, 'value' | 'source' | 'origin' | 'originScope'> & {
    reason: string | undefined;
};

export type KnownSettings = {
    settings: Map<string, Setting>;
    defaults: Map<string, SettingDefault>;
    errors: { key: string; message: string }[];
};

/** A written key matched to its setting, language, and category. */
export type SettingMatch = { setting: Setting; language?: string; category?: string };

export type WrittenSetting = Pick<EffectiveSetting, 'value' | 'reason'>;

export type WrittenScopeTable = { table: SettingsTable; scope?: string; path: KeyPath };

/** A setting default and the configuration that sets it. */
export type SettingDefault = { value: unknown; configuration: string };

/** Transform or observe one declared path without changing its role. */
export type PathVisitor = (path: string, keys: KeyPath, role: NonNullable<Setting['path_role']>) => string;
