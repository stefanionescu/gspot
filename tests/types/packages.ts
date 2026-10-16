import type { Session } from '#cli/types/planning.ts';
import type { ToolDeclaration } from '#cli/types/configurations.ts';
import type { AsyncSpawnOptions } from '#cli/types/system/processes.ts';

/** The working directory, environment, and limit owned by an installed-consumer command. */
export type CommandOptions = Required<Pick<AsyncSpawnOptions, 'cwd' | 'env'>>;

/** A fresh consumer of the release: its install, its folder, the command that runs gspot, and the options it runs with. */
export type PackedSandbox = {
    root: string;
    command: string[];
    /** Check commands cannot reach the network. */
    offlineOptions: CommandOptions;
    /** Acquisition commands can reach the isolated registry and its upstream. */
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

/** A packed package transferred from the suite runner to its installation tests. */
export type PackedPackage = Omit<RegistryPackage, 'source'> & { filename: string; integrity: string };

/** Locally served package bytes, optionally protected by a credential. */
export type NpmRegistry = AsyncDisposable & { url: string; npmrc: string; readonly requests: number };

/** A package project in a sandbox: the project, its local registry, and the files the install reads. */
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

/** Managed bytes and file mode captured before package installation. */
export type ToolProjectFiles = {
    manifest: Uint8Array;
    lockfilePath: string;
    lockfile: Uint8Array;
    mode: number;
};

/** Project bytes captured before a locked tool installation. */
export type LockedInputs = {
    session: Session;
    inputs?: ToolProjectFiles;
    manifest?: Buffer<ArrayBuffer>;
    lockfilePath?: string;
    lockfile?: Buffer<ArrayBuffer>;
};

/** A Python project whose local index, authored bytes, and locked inputs have one lifetime. */
export type IndexedPythonSandbox = AsyncDisposable & {
    rootProject: Buffer<ArrayBuffer>;
    rootConfiguration: Buffer<ArrayBuffer>;
    registry: { url: string; readonly requests: number };
    inputs: LockedInputs;
};
