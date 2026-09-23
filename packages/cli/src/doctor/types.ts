// What doctor reports.

export type ToolState = 'ok' | 'outdated' | 'newer' | 'missing' | 'host' | 'error';

/** The two facts of a package.json that say which package it is. */
export type PackageFacts = { name?: string; version?: string };

export type VersionObservation = { version: string } | { state: 'missing' | 'error'; note: string };

export type ToolProbe = {
    name: string;
    state: ToolState;
    want?: string;
    found?: string;
    path?: string;
    hint?: string;
    note?: string;
    floor?: string;
};

export type ToolContext = {
    root: string;
    cwd?: string;
    probes: Map<string, ToolProbe>;
    policyFiles?: import('#cli/policy/types.ts').PolicyFiles;
};

export type CoverageReport = {
    endings: { ending: string; scope: string; files: number; kinds: string[] }[];
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

export type DoctorReport = {
    submodules: string[];
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
export type DoctorOptions = { cwd: string };
