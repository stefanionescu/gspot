import type { ToolPin } from '#cli/types/configurations.ts';
import type { LockName } from '#cli/types/parsers/lockfiles.ts';
import type { PackageRegistry } from '#automation/types/registry.ts';

/** A package project in a sandbox: the project, its local registry, and the files the install reads. */
export type PackageProject = {
    root: string;
    artifacts: string;
    registry: PackageRegistry;
    tools: ToolPin[];
    rootPackage: string;
    yarnConfiguration: string | undefined;
    version: string;
    [Symbol.asyncDispose](): Promise<void>;
};

/** Inputs for authoring a native package-manager installation fixture. */
export type PackageProjectOptions = {
    root: string;
    artifacts: string;
    registry: PackageRegistry;
    installer: LockName;
    projectPath: string;
    runner: 'mise' | 'none';
};

/** Managed bytes and file mode captured before package installation. */
export type PackageInputs = {
    manifest: NonSharedBuffer;
    lockPath: string;
    lock: NonSharedBuffer;
    mode: number;
    ownershipPath: string;
    ownership: NonSharedBuffer;
};
