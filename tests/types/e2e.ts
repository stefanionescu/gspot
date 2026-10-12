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
