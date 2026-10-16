import type { LIST_KINDS } from '#cli/config/commands/list.ts';
import type { EffectiveSetting } from '#cli/types/settings/values.ts';
import type { SettingDeclaration } from '#cli/types/settings/tables.ts';

type SettingRow = {
    key: string;
    value: unknown;
    source: string;
    origin: EffectiveSetting['origin'];
    originScope?: string;
    reason_needed: SettingDeclaration['reason_needed'];
    scope: string;
};

/** One `[tools.<tool>.extra]` table: the keys it sets and why. */
type ExtraRow = { tool: string; keys: string[]; reason?: string; scope: string };

/** The JSON response of selected and available configurations. */
export type ConfigurationsListJson = {
    selected: { name: string; checks: { name: string; scope: string; state: string }[] }[];
    available: { name: string; description: string }[];
};

/** Effective settings and authored extra options printed by list settings. */
export type SettingsListJson = { settings: SettingRow[]; extras: ExtraRow[] };

export type ListKind = (typeof LIST_KINDS)[number];
