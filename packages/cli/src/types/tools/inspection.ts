import type { Tool, ToolFolderKind } from '#cli/types/configurations.ts';

type ToolState = 'ok' | 'outdated' | 'newer' | 'missing' | 'system' | 'error';
export type InspectedTool = {
    timeoutSeconds: number;
    root: string;
    cwd: string;
    tool: Tool;
    help: string;
    want: string | undefined;
    miseBinPaths: string[] | undefined;
};
export type ToolInspection = {
    name: string;
    state: ToolState;
    want?: string;
    found?: string;
    path?: string;
    help?: string;
    note?: string;
    minimumVersion?: string;
};
export type ToolSearch = {
    timeoutSeconds: number;
    root: string;
    /** The working tree whose installed Python tools run, when root points to a copy. */
    installedRoot?: string;
    cwd?: string;
    inspections: Map<string, ToolInspection>;
    miseBinPaths?: string[];
};
export type ExecutableSearch = {
    searchFolders: string[];
    miseBinPaths?: string[] | undefined;
    toolFolderKind?: ToolFolderKind | undefined;
};

/** The classified version or failure of a completed version command. */
export type ParsedToolVersion = { version: string } | { state: 'missing' | 'error'; note: string };
