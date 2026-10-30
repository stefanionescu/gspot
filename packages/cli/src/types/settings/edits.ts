import type { FileContents } from '#cli/types/system/files.ts';
import type { Settings, TomlTable } from '#cli/types/settings/settings.ts';

export type SettingsFileContents = { text: string; previous: FileContents };

export type SettingsEdit = SettingsFileContents & { table: TomlTable };

export type EditedSettings = { text: string; settings: Settings; changed: boolean };

export type SettingKey = { path: string[]; name: string };
