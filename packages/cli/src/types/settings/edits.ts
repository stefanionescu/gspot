import type { FileContents } from '#cli/types/system/files.ts';
import type { Settings, TomlTable } from '#cli/types/settings/settings.ts';

export type SettingsEdit = { text: string; table: TomlTable; previous: FileContents };

export type EditedSettings = { text: string; settings: Settings; changed: boolean };

export type SettingKey = { path: string[]; name: string };
