import type { CliReference } from '@gspothq/cli/reference';

export type SettingReference = CliReference['settings'][number];
export type SettingVariant = SettingReference['variants'][number];
export type AcceptedSettingValues = SettingReference['accepted'];

export type Suppression = CliReference['suppressions'][number]['form'];
