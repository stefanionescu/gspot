import type { Session } from '#cli/types/planning.ts';
import type { ToolDeclaration } from '#cli/types/configurations.ts';
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
    tools: ToolDeclaration[];
    rootPackage: string;
    yarnConfiguration: string | undefined;
    version: string;
    [Symbol.asyncDispose](): Promise<void>;
};

/** Tool project files read before an install. */
export type ToolProjectFiles = {
    manifest: Uint8Array;
    lockfilePath: string;
    lockfile: Uint8Array;
    mode: number;
};

/** Tool project files read before a locked install. */
export type LockedInputs = {
    session: Session;
    inputs?: ToolProjectFiles;
    manifest?: Buffer<ArrayBuffer>;
    lockfilePath?: string;
    lockfile?: Buffer<ArrayBuffer>;
};

/** A Python project and its local package index, disposed together. */
export type IndexedPythonSandbox = AsyncDisposable & {
    rootProject: Buffer<ArrayBuffer>;
    rootConfiguration: Buffer<ArrayBuffer>;
    registry: { url: string; readonly requests: number };
    inputs: LockedInputs;
};
