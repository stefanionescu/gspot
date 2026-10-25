import type { Configuration } from '#cli/types/configurations.ts';
import type { ScopeFolder } from '#cli/types/repository/files.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import type { PATH_ROLES } from '#cli/config/settings/available.ts';
import type { SETTING_TYPES } from '#cli/config/settings/inheritance.ts';
import type { ReasonRequirement } from '#cli/types/settings/definitions.ts';
import type { Settings, TableValues, IgnoreRecord, SettingsTable } from '#cli/types/settings/file.ts';

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
    reason_when?: ReasonRequirement;
    reason_values?: boolean;
    description: string;
    languages?: string[];
};

export type Scope = {
    folder: ScopeFolder;
    configurations: Configuration[];
    availableSettings: AvailableSettings;
    settings: ScopeSettings;
};

export type ScopeSettings = {
    configurations: string[];
    test_files: Settings['test_files'];
    settings: Record<string, unknown>;
    values: TableValues;
    ignores: (IgnoreRecord & { paths: string[] })[];
};

export type InheritedSetting = {
    key: string;
    setting: Setting;
    value: unknown;
    reason?: string;
    source: string;
    origin: 'root' | 'scope' | 'configuration' | 'unset';
    originScope?: string;
    scope?: string;
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

export type WrittenScopeTable = { table: SettingsTable; scope?: string; path: KeyPath };

export type SettingDefault = { value: unknown; configuration: string };

export type PathVisitor = (path: string, keys: KeyPath, role: NonNullable<Setting['path_role']>) => string;
