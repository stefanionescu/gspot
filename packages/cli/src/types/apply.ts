import type { JsonValue } from '#cli/types/shapes.ts';
import type { Settings } from '#cli/types/settings/file.ts';
import type { SettingsEdit } from '#cli/types/settings/edits.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import { type Files, type ReadCache, type FileContents } from '#cli/types/system/files.ts';

export type ApplyReport = {
    written: string[];
    unchanged: string[];
    removed: string[];
    /** Your own files that gspot changed in place: a managed block or tool settings. */
    updated: string[];
    notes: string[];
};

export type OutdatedFile = {
    path: string;
    kind: 'changed' | 'missing' | 'stray';
    diff?: string;
};

export type SaveSettingsOptions = { edit: SettingsEdit; summary: string };

export type ConfigurationsOptions = { cwd: string; configurations: string[]; scope?: string };

/** The settings read once before a command edits their table. */
export type PreparedSettingsEdit = { root: string; input: SettingsEdit; settings: Settings; reads: ReadCache };

/** One locked repository writer. */
export type Writer = { files: Files; [Symbol.dispose](): void };

export type ManagedKeys = { path: string; keys: { key: KeyPath; value: JsonValue | undefined }[] };

export type ReplacementRequest = {
    path: string;
    next: FileContents;
    expected?: FileContents | undefined;
};

/** New bytes or a removal, with the file contents expected on disk. */
export type WritePlan = {
    path: string;
    before: FileContents | undefined;
    status: 'changed' | 'unchanged' | 'preserved';
    after?: FileContents;
};
