import type { ReadCache } from '#cli/types/system/files.ts';
import type { SettingsEdit } from '#cli/types/settings/edits.ts';
import type { Settings, TomlTable } from '#cli/types/settings/file.ts';

export type SaveSettingsOptions = { edit: SettingsEdit; summary: string; notes?: string[] };

export type ConfigurationsOptions = { cwd: string; configurations: string[]; scope?: string };

export type SettingsEditContext = {
    root: string;
    input: SettingsEdit;
    settings: Settings;
    reads: ReadCache;
    scope: string | undefined;
    scopeTable: TomlTable;
};
