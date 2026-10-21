import type { ReadCache } from '#cli/types/system/files.ts';
import type { CommandResult } from '#cli/types/terminal.ts';
import type { SettingsEdit } from '#cli/types/settings/edits.ts';
import type { StaleFile, ApplyReport } from '#cli/types/apply.ts';
import type { SettingDeclaration } from '#cli/types/settings/tables.ts';
import type { Settings, EffectiveSetting } from '#cli/types/settings/values.ts';

export type SaveSettingsOptions = { input: SettingsEdit; summary: string };
export type SaveSettingsResult = CommandResult<ApplyReport & { changed: boolean }>;

export type ConfigurationsOptions = { cwd: string; configurations: string[]; scope?: string };

export type ApplyOptions = {
    cwd: string;
    isDryRun: boolean;
};

export type DryRunJson = {
    dryRun: true;
    pin: { from: string | undefined; to: string };
    stale: StaleFile[];
};

export type IgnoreOptions = {
    cwd: string;
    check?: string;
    paths?: string[];
    rule?: string;
    names?: string[];
    reason: string;
    until?: string;
};

export type SetOptions = {
    cwd: string;
    key: string;
    items: string[];
    reason?: string;
    scope?: string;
};

export type ParsedSettingValue = { type: 'list'; value: unknown[] } | { type: 'scalar'; value: unknown };

/** Matching ignore removals and the records that remain after removing individual paths. */
export type IgnoreRemoval = {
    kept: unknown[];
    deleted: number;
    changedIgnores: number;
    removedPaths: number;
    everywhere: number;
};

export type UnsetOptions = { cwd: string; key: string; items: string[]; scope?: string };

/** The settings read once before a command edits their table. */
export type PreparedSettingsEdit = { root: string; input: SettingsEdit; settings: Settings; reads: ReadCache };

/** A proposed setting value and the reason rules that apply to it. */
export type SettingReasonContext = {
    options: SetOptions;
    declaration: SettingDeclaration;
    change: ParsedSettingValue;
    previous: EffectiveSetting | undefined;
    shippedDefault: unknown;
};
