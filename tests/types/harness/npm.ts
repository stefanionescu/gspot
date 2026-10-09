import type { readFile } from 'node:fs/promises';
import type { ToolPin } from '#cli/types/parsers/tool.ts';
import type { PackageInstaller } from '#cli/types/parsers/packages.ts';
import type { PackageRegistry } from '#tests/types/harness/registry.ts';

type PackageBytes = Exclude<Awaited<ReturnType<typeof readFile>>, string>;

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

/** Inputs for authoring a native package-manager installation sandbox. */
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
    manifest: PackageBytes;
    lockfilePath: string;
    lockfile: PackageBytes;
    mode: number;
    ownershipPath: string;
    ownership: PackageBytes;
};
