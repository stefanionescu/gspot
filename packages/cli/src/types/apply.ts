import type { Settings } from '#cli/types/settings/file.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import type { SettingsEdit } from '#cli/types/settings/edits.ts';

export type ApplyReport = {
    written: string[];
    unchanged: string[];
    removed: string[];
    /** Authored files gspot changed in place: a managed block or tool settings. */
    updated: string[];
    notes: string[];
};

export type StaleFile = {
    path: string;
    kind: 'changed' | 'missing' | 'stray';
    diff?: string;
};

export type SaveSettingsOptions = { edit: SettingsEdit; summary: string };

export type ConfigurationsOptions = { cwd: string; configurations: string[]; scope?: string };

/** The settings read once before a command edits their table. */
export type PreparedSettingsEdit = { root: string; input: SettingsEdit; settings: Settings; reads: ReadCache };
