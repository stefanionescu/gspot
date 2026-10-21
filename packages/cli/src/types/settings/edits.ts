import type { TomlTable } from '#cli/types/settings/file.ts';
import type { Settings } from '#cli/types/settings/values.ts';
import type { FileContents } from '#cli/types/system/files.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';

export type SettingsFileContents = { text: string; original: FileContents };

export type SettingsEdit = { text: string; table: TomlTable; original: FileContents };

export type EditedSettings = { text: string; settings: Settings; changed: boolean };

export type SettingKey = { path: string[]; name: string };

/** An ordered header and its written values. */
export type LayoutSection = { path: KeyPath; table: TomlTable };
