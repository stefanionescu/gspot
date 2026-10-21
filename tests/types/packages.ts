import type { AsyncSpawnOptions } from '#cli/types/system/processes.ts';

/** The working folder and environment of a command in a packed sandbox. */
export type CommandOptions = Required<Pick<AsyncSpawnOptions, 'cwd' | 'env'>>;

/** A new project that installs the packed gspot release. */
export type PackedSandbox = {
    root: string;
    command: string[];
    /** Check commands cannot reach the network. */
    offlineOptions: CommandOptions;
    /** Install commands can reach the local registry and its upstream. */
    onlineOptions: CommandOptions;
    workspace: string;
    [Symbol.asyncDispose]: () => Promise<void>;
};

/** Package metadata and its local source to pack for installation. */
export type RegistryPackage = {
    name: string;
    source: string;
    version: string;
    bin?: Record<string, string> | undefined;
    dependencies?: Record<string, string> | undefined;
    peerDependencies?: Record<string, string> | undefined;
};

/** A packed package that the test run prepares for its install tests. */
export type PackedPackage = Omit<RegistryPackage, 'source'> & { filename: string; integrity: string };

/** Locally served package bytes, optionally protected by a credential. */
export type NpmRegistry = AsyncDisposable & { url: string; npmrc: string; readonly requests: number };

/** A package project in a sandbox, with its own local registry. */
export type PackageManagerSandbox = {
    root: string;
    artifacts: string;
    registry: NpmRegistry;
    rootPackage: string;
    yarnConfiguration: string | undefined;
    [Symbol.asyncDispose](): Promise<void>;
};

/** Tool project files read before an install. */
export type ToolProjectFiles = {
    manifest: Buffer<ArrayBuffer>;
    lockfilePath: string;
    lockfile: Buffer<ArrayBuffer>;
    mode: number;
};

/** A Python project and its local package index, disposed together. */
export type IndexedPythonSandbox = AsyncDisposable & {
    rootProject: Buffer<ArrayBuffer>;
    rootConfiguration: Buffer<ArrayBuffer>;
    inputs: ToolProjectFiles;
};
