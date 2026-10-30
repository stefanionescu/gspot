import type { LIST_KINDS } from '#cli/config/commands/commands.ts';
import type { OutdatedFile } from '#cli/types/generation/files.ts';
import type { Setting, InheritedSetting, RemovedConfiguration } from '#cli/types/settings/inheritance.ts';

export type ApplyOptions = {
    cwd: string;
    dryRun: boolean;
};

export type DryRunJson = {
    dryRun: true;
    outdated: OutdatedFile[];
};

export type IgnoreOptions = {
    cwd: string;
    check?: string | undefined;
    paths?: string[] | undefined;
    rule?: string | undefined;
    reason: string;
};

export type InstallCommandJson = { summary: string; steps: readonly (readonly string[])[]; notes: string[] };

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

export type SetOptions = {
    cwd: string;
    key: string;
    values: string[];
    reason?: string | undefined;
    scope?: string | undefined;
};

export type ParsedSettingValue = { type: 'list'; value: unknown[] } | { type: 'scalar'; value: unknown };

export type SettingReasonContext = {
    options: SetOptions;
    setting: Setting;
    change: ParsedSettingValue;
    previous: InheritedSetting | undefined;
    shippedDefault: unknown;
};

export type IgnoreRemoval = {
    kept: unknown[];
    deleted: number;
    changedIgnores: number;
    removedPaths: number;
    everywhere: number;
};

export type IgnoreTarget = { unmatched: string; removed: string };

export type UnsetOptions = { cwd: string; key: string; keys: string[]; scope?: string | undefined };
