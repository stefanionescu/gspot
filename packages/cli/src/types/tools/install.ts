import type { Snapshot } from '#cli/types/platform/root.ts';
import type { ToolPin } from '#cli/types/configurations.ts';
import type { PolicyFile } from '#cli/types/policy/settings.ts';
import type { INSTALLATION_KINDS } from '#cli/config/tools/install.ts';
import type { ExecutionFailure } from '#cli/types/execution/runtime.ts';

/** One tool pin as mise reads it: the version, the operating systems that have a build, and backend options. */
export type MisePin = {
    name: string;
    version: string;
    os?: string[];
    options?: Record<string, string | number | boolean>;
};

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
    /** The working tree whose installed Python tools run, when root is a snapshot of it. */
    installedRoot?: string;
    cwd?: string;
    inspections: Map<string, ToolInspection>;
    policyFiles?: PolicyFile;
    /** The installations an interrupted gspot install left pending under a root; none when unset. */
    getPendingInstallations?: (root: string) => string[] | undefined;
};

/** A private tool installation gspot writes whole: the npm tools or the Python environment. */
export type InstallationKind = (typeof INSTALLATION_KINDS)[number];

/** One file of a finished installation, at its path under the installation folder. */
export type InstalledOutput = { path: string; file: Snapshot };

/** The part of the lifecycle owner a tool project reads and installs through. */
export type ToolOwner = {
    read(path: string): Snapshot | undefined;
    installTree(kind: InstallationKind, outputs: InstalledOutput[]): void;
};

/** The configuration responsible for one declared acquisition version. */
export type PinRequirement = { version: string; owner: string };

/** An inspected executable with a usable version and resolved path. */
export type AvailableToolInspection = ToolInspection & { path: string };

/** A usable executable or the diagnostic that prevents it from running. */
export type ToolAvailability = { path: string } | ExecutionFailure;

/** A generated tool project whose recorded lock is absent or stale. */
export type LockDrift = { path: string; kind?: 'missing' | 'changed' };
/** Whether the caller requests resolution from declared pins instead of reusing a matching lock. */
export type LockPreparation = { refreshLocks: boolean };
/** A tool version also declared in repository-owned setup. */
export type DuplicateMisePin = { tool: string; version: string; gspotFile: string };
/** A pinned package installed privately for applicable checks. */
export type PrivateToolPackage = { kind: InstallationKind; name: string; version: string };
/** A declared mise installer and its backend prefix. */
export type MiseBackend = { installer: string; prefix: string };

/** Folders and private-installation ownership restricting executable discovery. */
export type LocateOptions = {
    searchFolders: string[];
    privateKind?: InstallationKind | undefined;
    installedRoot?: string | undefined;
};

/** The tool search, selected pin, and process limits of Vale package acquisition. */
export type ValeInstallation = {
    search: ToolSearch;
    tool: ToolPin;
    timeoutSeconds: number;
    cancelSignal?: AbortSignal | undefined;
};
