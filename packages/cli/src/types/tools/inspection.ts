import type { Tool, ToolFolderKind } from '#cli/types/configurations.ts';

type ToolState = 'ok' | 'outdated' | 'newer' | 'missing' | 'system' | 'error';
export type InspectedTool = {
    timeoutSeconds: number;
    root: string;
    cwd: string;
    tool: Tool;
    missing: ToolInspection;
    help: string;
    want: string | undefined;
    miseBinPaths: string[] | undefined;
};
export type ToolInspection = {
    name: string;
    state: ToolState;
    want?: string | undefined;
    found?: string | undefined;
    path?: string | undefined;
    help?: string | undefined;
    note?: string | undefined;
    minimumVersion?: string | undefined;
};
export type ToolSearch = {
    timeoutSeconds: number;
    root: string;
    toolsRoot?: string;
    cwd?: string;
    inspections: Map<string, ToolInspection>;
    miseBinPaths?: string[];
};
export type ExecutableSearch = {
    folders: string[];
    miseBinPaths?: string[] | undefined;
    toolFolderKind?: ToolFolderKind | undefined;
};

export type ParsedToolVersion = { version: string } | { state: 'missing' | 'error'; note: string };
