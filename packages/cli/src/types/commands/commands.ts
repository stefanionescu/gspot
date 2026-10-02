// The types of commands in this package.
import type { Read } from '#cli/types/platform/platform.ts';
import type { WriteResult } from '#cli/types/policy/policy.ts';
import type { DriftEntry } from '#cli/types/lifecycle/lifecycle.ts';

type SettingRow = {
    key: string;
    value: unknown;
    source: string;
    direction: string;
    scope?: string;
};

export type SetOptions = {
    cwd: string;
    key: string;
    items: string[];
    reason?: string;
    scope?: string;
    replace: boolean;
    remove: boolean;
    toDefault: boolean;
};

export type CommandResult = { text: string; json: unknown; exitCode: number };

/** The JSON a failed command prints: the error's name and message. */
export type CommandFailureJson = { error: string; message: string };
export type IgnoreOptions = {
    cwd: string;
    check: string;
    paths?: string[];
    rule?: string;
    reason?: string;
    remove: boolean;
};
export type Choice<T extends string> = { value: T; label: string; hint?: string | undefined };
export type AddOptions = { cwd: string; isDryRun: boolean; kits: string[]; scope?: string };
export type RemoveOptions = { cwd: string; isDryRun: boolean; kit: string; scope?: string };

export type ApplyOptions = {
    cwd: string;
    isDryRun: boolean;
};

/** The JSON a dry-run apply prints: the version pin, the drifted files, and the notes of the plan. */
export type ApplyPreviewJson = {
    isDryRun: true;
    pin: { from: string | undefined; to: string };
    drift: DriftEntry[];
    notes: string[];
};

export type PreparedPolicy = WriteResult & { original: Read };

/** One `[tools.<tool>.extra]` table: the keys it sets and why. */
export type ExtraRow = { tool: string; keys: string[]; reason?: string; scope: string };

/** The settings listing. */
export type SettingsListing = { rows: SettingRow[]; extras: ExtraRow[] };

/** The `[tools.<tool>]` tables of one policy layer, as the settings listing reads them. */
export type ToolTables = Record<string, { extra?: Record<string, unknown> & { reason?: string } }>;

export type ChangeKey =
    | 'detectedNotSelected'
    | 'recommendedNotSelected'
    | 'configurationNotOwned'
    | 'changedOutsideGspot';
