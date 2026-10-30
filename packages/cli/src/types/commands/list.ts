import type { LIST_KINDS } from '#cli/config/commands/list.ts';
import { type Setting, type InheritedSetting, type RemovedConfiguration } from '#cli/types/settings/inheritance.ts';

type SettingRow = {
    key: string;
    value: unknown;
    source: string;
    origin: InheritedSetting['origin'];
    originScope?: string | undefined;
    reason_when: Setting['reason_when'];
    scope: string;
};

export type ConfigurationsListJson = {
    selected: { name: string; checks: { name: string; scope: string; state: string }[] }[];
    removed: RemovedConfiguration[];
    available: { name: string; description: string }[];
};

export type SettingsListJson = { settings: SettingRow[] };

export type ListKind = (typeof LIST_KINDS)[number];
