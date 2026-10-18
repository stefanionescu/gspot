import type { CommandResult } from '#cli/types/terminal.ts';
import type { StaleFile, ApplyReport } from '#cli/types/apply.ts';
import type { Mutation, SettingsEdit } from '#cli/types/settings/edits.ts';

export type SaveSettingsOptions = { input: SettingsEdit; change: Mutation; summary: string };
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
    notes: string[];
};

export type IgnoreOptions = {
    cwd: string;
    check: string;
    paths?: string[];
    rule?: string;
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
