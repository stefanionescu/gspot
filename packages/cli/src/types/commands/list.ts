import type { LIST_KINDS } from '#cli/config/commands/list.ts';
import { type Setting, type EffectiveSetting } from '#cli/types/settings/inheritance.ts';

type SettingRow = {
    key: string;
    value: unknown;
    source: string;
    origin: EffectiveSetting['origin'];
    originScope?: string;
    reason_needed: Setting['reason_needed'];
    scope: string;
};

export type ConfigurationsListJson = {
    selected: { name: string; checks: { name: string; scope: string; state: string }[] }[];
    available: { name: string; description: string }[];
};

export type SettingsListJson = { settings: SettingRow[] };

export type ListKind = (typeof LIST_KINDS)[number];
