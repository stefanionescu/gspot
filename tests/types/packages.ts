import type { Sandbox } from '#tests/types/sandbox.ts';

/** A new project where npm installs gspot from the local registry, as a user does. */
export type UserProject = AsyncDisposable & {
    root: string;
    workspace: string;
    /** Install commands can reach the local registry and its upstream. */
    online: Sandbox;
    /** Check commands cannot reach the network. */
    offline: Sandbox;
};

/** A package.json and the local source to pack for installation. */
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

/** A project for one package manager, with its own local registry. */
export type NpmProject = {
    root: string;
    artifacts: string;
    registry: NpmRegistry;
    rootPackage: string;
    yarnConfiguration: string | undefined;
    [Symbol.asyncDispose](): Promise<void>;
};

/** Tool project files read before an install. */
export type ToolProjectFiles = {
    projectFile: Buffer<ArrayBuffer>;
    lockfilePath: string;
    lockfile: Buffer<ArrayBuffer>;
    mode: number;
};

/** A Python project and its local package index, disposed together. */
export type IndexedPythonProject = AsyncDisposable & {
    rootProject: Buffer<ArrayBuffer>;
    rootConfiguration: Buffer<ArrayBuffer>;
    projectFiles: ToolProjectFiles;
};
