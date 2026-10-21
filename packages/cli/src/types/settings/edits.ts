import type { FileContents } from '#cli/types/system/files.ts';
import type { Settings, TomlTable } from '#cli/types/settings/file.ts';

export type SettingsFileContents = { text: string; original: FileContents };

export type SettingsEdit = { text: string; table: TomlTable; original: FileContents };

export type EditedSettings = { text: string; settings: Settings; changed: boolean };

export type SettingKey = { path: string[]; name: string };
