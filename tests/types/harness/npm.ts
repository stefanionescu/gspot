import type { ToolPin } from '#cli/types/configurations.ts';
import type { PackageInstaller } from '#cli/types/parsers/packages.ts';
import type { PackageRegistry } from '#tests/types/harness/registry.ts';

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
    installer: PackageInstaller['name'];
    projectPath: string;
    runner: 'mise' | 'none';
};

/** Managed bytes and file mode captured before package installation. */
export type PackageInputs = {
    manifest: NonSharedBuffer;
    lockfilePath: string;
    lockfile: NonSharedBuffer;
    mode: number;
    ownershipPath: string;
    ownership: NonSharedBuffer;
};
