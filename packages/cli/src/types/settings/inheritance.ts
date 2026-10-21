import type { ReasonNeeded } from '#cli/types/settings/facts.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import type { ScopeFolder } from '#cli/types/repository/inventory.ts';
import type { PATH_ROLES, SETTING_TYPES } from '#cli/config/settings/schema.ts';
import type { Settings, TableValues, IgnoreRecord, SettingsTable } from '#cli/types/settings/file.ts';

/** Configuration choices declared at the root and in project scopes. */
export type ConfigurationSelection = {
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
    scope: ScopeFolder;
    selected: Configuration[];
    known: KnownSettings;
    view: ScopeView;
};

/** Values validated once for one scope, then read by checks and generators. */
export type ScopeSettings = {
    settings: Record<string, unknown>;
    values: TableValues;
    test_files: Settings['test_files'];
};

export type ScopeView = {
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
export type SettingState = Pick<EffectiveSetting, 'value' | 'source' | 'origin' | 'originScope'> & {
    reason: string | undefined;
};

export type KnownSettings = {
    settings: Map<string, Setting>;
    defaults: Map<string, SettingDefault>;
    errors: { key: string; message: string }[];
};

/** A written key matched to its declaration and its declared language and category. */
export type SettingMatch = { setting: Setting; language?: string; category?: string };

export type WrittenSetting = Pick<EffectiveSetting, 'value' | 'reason'>;

export type WrittenScopeTable = { table: SettingsTable; scope?: string; path: KeyPath };

/** A setting default and the configuration responsible for it. */
export type SettingDefault = { value: unknown; configuration: string };

/** Transform or observe one declared path without changing its role. */
export type PathVisitor = (path: string, keys: KeyPath, role: NonNullable<Setting['path_role']>) => string;
