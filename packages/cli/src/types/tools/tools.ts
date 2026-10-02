// The types of tools in this package.
import type { z } from 'zod';
import type { ToolPin, Manifest } from '#cli/types/kits.ts';
import type { Repository } from '#cli/types/repository/repository.ts';
import type { Read, ReadCache } from '#cli/types/platform/platform.ts';
import type { packageToolSchema } from '#cli/tools/packages/identity.ts';
import type { PolicyFiles, ScopeSelection } from '#cli/types/policy/policy.ts';

type ToolState = 'ok' | 'outdated' | 'newer' | 'missing' | 'host' | 'error';

/** A private tool installation gspot writes whole: the npm tools or the Python environment. */
export type InstallationKind = 'npm' | 'python';

export type Session = ToolSearch & {
    reads: ReadCache;
    resources?: DisposableStack;
    packageClient?: z.infer<typeof packageToolSchema>;
    cancelSignal?: AbortSignal;
    version: string;
    policyFiles: PolicyFiles;
    manifests: Map<string, Manifest>;
    repository: Repository;
    scopes: ScopeSelection[];
};

/** One tool pin as mise reads it: the version, the operating systems that have a build, and backend options. */
export type MisePin = { name: string; version: string; os?: string[]; options?: Record<string, string | boolean> };

/** One file of a finished installation, at its path under the installation folder. */
export type InstalledOutput = { path: string; file: Read };

/** The part of the lifecycle owner a tool project reads and installs through. */
export type ToolOwner = {
    read(path: string): Read | undefined;
    installTree(kind: InstallationKind, outputs: InstalledOutput[]): void;
};

export type Inspected = { root: string; cwd: string; tool: ToolPin; path: string; hint: string };
export type VersionRead = { version: string } | { state: 'missing' | 'error'; note: string };
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
    policyFiles?: PolicyFiles;
    /** The installations an interrupted gspot install left pending under a root; none when unset. */
    installations?: (root: string) => string[] | undefined;
};

/** The two fields of a package.json that say which package it is. */
export type Package = { name?: string; version?: string };
export type PrivateKind = 'npm' | 'python';
