// What doctor reports.

export type ToolState = 'ok' | 'outdated' | 'newer' | 'missing' | 'host';

/** The two facts of a package.json that say which package it is. */
export type PackageFacts = { name?: string; version?: string };

export type ToolProbe = {
    name: string;
    state: ToolState;
    want?: string;
    found?: string;
    path?: string;
    hint?: string;
    floor?: string;
};

export type CoverageReport = {
    unchecked: { path: string; reason: string; remedy?: string }[];
    partial: { path: string; missing: string[] }[];
    checked: number;
};

export type ChangeReport = {
    detectedNotSelected: { preset: string; evidence: string; command: string }[];
    recommendedNotSelected: { preset: string; evidence: string; command: string }[];
    configurationNotOwned: { path: string; note: string; command: string }[];
    changedOutsideGspot: { path: string; note: string; command: string }[];
    pinnedTwice: { tool: string; version: string; places: string[]; command: string }[];
};

export type SettingRow = {
    key: string;
    value: unknown;
    source: string;
    direction: string;
    scope?: string;
};

export type DoctorReport = {
    tools: ToolProbe[];
    coverage: CoverageReport;
    changes: ChangeReport;
    hooks: string;
    ci: string;
    rules: { files: number };
    version: { running: string; pinned?: string };
    exitCode: number;
};

/** The change sections that share one row shape. */
export type ChangeKey =
    | 'detectedNotSelected'
    | 'recommendedNotSelected'
    | 'configurationNotOwned'
    | 'changedOutsideGspot';

/** One row of the change report: a path, what is wrong with it, and the command that fixes it. */
export type ChangeRow = { path: string; note: string; command: string };

/** gspot doctor. */
export type DoctorOptions = { cwd: string; settings: boolean };

/** One `[tools.<tool>.extra]` table: the keys it sets and why. */
export type ExtraRow = { tool: string; keys: string[]; reason: string; scope: string };

/** The --settings listing. */
export type SettingsListing = { rows: SettingRow[]; extras: ExtraRow[] };

/** The `[tools.<tool>]` tables of one policy layer, as the settings listing reads them. */
export type ToolTables = Record<string, { extra?: Record<string, unknown> & { reason: string } }>;
