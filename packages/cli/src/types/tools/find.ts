import type { SettingsFile } from '#cli/types/settings/values.ts';
import type { ToolDeclaration, InstalledToolFolder } from '#cli/types/configurations.ts';

type ToolState = 'ok' | 'outdated' | 'newer' | 'missing' | 'system' | 'error';
export type Inspected = {
    timeoutSeconds: number;
    root: string;
    cwd: string;
    tool: ToolDeclaration;
    path: string;
    hint: string;
};
export type ToolInspection = {
    name: string;
    state: ToolState;
    want?: string;
    found?: string;
    path?: string;
    hint?: string;
    note?: string;
    floor?: string;
};
export type ToolSearch = {
    timeoutSeconds: number;
    root: string;
    /** The working tree whose installed Python tools run, when root points to a scratch copy. */
    installedRoot?: string;
    cwd?: string;
    inspections: Map<string, ToolInspection>;
    miseBinPaths?: string[];
    settingsFile?: SettingsFile;
};
export type AvailableToolInspection = ToolInspection & { path: string };
export type LocateOptions = {
    searchFolders: string[];
    miseBinPaths?: string[] | undefined;
    toolProjectKind?: InstalledToolFolder | undefined;
    installedRoot?: string | undefined;
};

/** The classified version or failure of a completed version command. */
export type ParsedToolVersion = { version: string } | { state: 'missing' | 'error'; note: string };
