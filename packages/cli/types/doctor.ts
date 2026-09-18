// What doctor reports.

export type ToolState = 'ok' | 'outdated' | 'newer' | 'missing' | 'host';

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
