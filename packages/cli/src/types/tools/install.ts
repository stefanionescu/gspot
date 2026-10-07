import type { FileCopy } from '#cli/types/platform/root.ts';
import type { Policy, PolicyFile } from '#cli/types/policy/settings.ts';
import type { ToolPin, InstallationKind } from '#cli/types/configurations.ts';

export type ToolState = 'ok' | 'outdated' | 'newer' | 'missing' | 'host' | 'error';

export type Inspected = { root: string; cwd: string; tool: ToolPin; path: string; hint: string };

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
    root: string;
    /** The working tree whose installed Python tools run, when root is a copy of it. */
    installedRoot?: string;
    cwd?: string;
    inspections: Map<string, ToolInspection>;
    policyFiles?: PolicyFile;
    /** The installations an interrupted gspot install left pending under a root; none when unset. */
    getPendingInstallations?: (root: string) => string[] | undefined;
};

/** One file of a finished installation, at its path under the installation folder. */
export type InstalledOutput = { path: string; file: FileCopy };

/** The part of the lifecycle owner a tool project reads and installs through. */
export type ToolOwner = {
    read(path: string): FileCopy | undefined;
    installTree(kind: InstallationKind, directory: string): void;
};

/** An inspected executable with a usable version and resolved path. */
export type AvailableToolInspection = ToolInspection & { path: string };

/** A usable executable or the diagnostic that prevents it from running. */
export type ToolAvailability = { path: string } | ExecutionFailure;

/** A generated tool project whose recorded lockfile is absent or stale. */
export type LockfileDrift = { path: string; kind?: 'missing' | 'changed' };
/** Whether the caller requests resolution from declared pins instead of reusing a matching lockfile. */
export type LockfilePreparation = { refreshLockfiles: boolean };
/** A tool version also declared in repository-owned setup. */
export type DuplicateMisePin = { tool: string; version: string; gspotFile: string };
/** Folders and tool-project ownership restricting executable discovery. */
export type LocateOptions = {
    searchFolders: string[];
    toolProjectKind?: InstallationKind | undefined;
    installedRoot?: string | undefined;
};

/** The tool search, selected pin, and process limits of Vale package acquisition. */
export type ValeInstallation = {
    level: Policy['level'];
    search: ToolSearch;
    tool: ToolPin;
    timeoutSeconds: number;
    cancelSignal?: AbortSignal | undefined;
};

/** A process failure that prevents check output from being interpreted. */
export type ExecutionFailure = { status: 'error' | 'missing'; note: string };
