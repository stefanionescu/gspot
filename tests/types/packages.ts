import type { Sandbox } from '#tests/types/sandbox.ts';

export type UserProject = AsyncDisposable & {
    root: string;
    workspace: string;
    online: Sandbox;
    offline: Sandbox;
};

export type RegistryPackage = {
    name: string;
    source: string;
    version: string;
    bin?: Record<string, string> | undefined;
    dependencies?: Record<string, string> | undefined;
    peerDependencies?: Record<string, string> | undefined;
};

export type PackedPackage = Omit<RegistryPackage, 'source'> & { filename: string; integrity: string };

export type NpmRegistry = AsyncDisposable & { url: string; npmrc: string; readonly requests: number };

export type NpmProject = {
    root: string;
    artifacts: string;
    registry: NpmRegistry;
    rootPackage: string;
    yarnConfiguration: string | undefined;
    [Symbol.asyncDispose](): Promise<void>;
};

export type ToolProjectFiles = {
    projectFile: Buffer<ArrayBuffer>;
    lockfilePath: string;
    lockfile: Buffer<ArrayBuffer>;
    mode: number;
};

export type IndexedPythonProject = AsyncDisposable & {
    rootProject: Buffer<ArrayBuffer>;
    rootConfiguration: Buffer<ArrayBuffer>;
    projectFiles: ToolProjectFiles;
};
