import type { Sandbox } from '#tests/types/sandbox.ts';
import type { ToolPackageManager } from '#cli/types/installers/install.ts';

export type GspotProject = AsyncDisposable & {
    root: string;
    workspace: string;
    environment: Record<string, string>;
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

export type NpmRegistry = Disposable & { url: string; npmrc: string; requests: number };

export type NpmProject = {
    root: string;
    artifacts: string;
    registry: NpmRegistry;
    rootPackage: string;
    yarnConfiguration: string | undefined;
    toolPackageManager: ToolPackageManager['name'];
    environment: Record<string, string>;
    [Symbol.asyncDispose](): Promise<void>;
};

export type ToolProjectFiles = {
    projectFile: Buffer<ArrayBuffer>;
    lockfilePath: string;
    lockfile: Buffer<ArrayBuffer>;
    mode: number;
};

export type PythonProject = AsyncDisposable & {
    rootProject: Buffer<ArrayBuffer>;
    rootConfiguration: Buffer<ArrayBuffer>;
};

export type IndexedPythonProject = PythonProject & { files: ToolProjectFiles };
