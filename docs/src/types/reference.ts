import type { readCliReference } from '#cli/reference.ts';

export type CliReference = ReturnType<typeof readCliReference>;
export type CommandReference = CliReference['commands'][number];
export type SettingReference = CliReference['settings'][number];
export type SettingVariant = SettingReference['variants'][number];
export type AcceptedSettingValues = SettingReference['accepted'];

export type Suppression = CliReference['suppressions'][number]['form'];
