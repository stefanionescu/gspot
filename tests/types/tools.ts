// The types of the tool harness: the npm and Python projects a test installs from a local registry.
import type { GeneratedFile } from '#cli/types/kits.ts';
import type { Session } from '#cli/types/tools/tools.ts';

/** A package project in a sandbox: the project, its local registry, and the files the install reads. */
export type CreatePackageProjectResult = {
    root: string;
    artifacts: string;
    registry: { token: string; url: string; readonly requests: number; [Symbol.asyncDispose](): Promise<void> };
    rootPackage: string;
    yarnConfiguration: string | undefined;
    version: string;
    [Symbol.asyncDispose](): Promise<void>;
};

/** A Python project prepared for installation: its scopes, the generated plans, and the root files before install. */
export type PreparePythonInstallationResult = {
    root: string;
    scopes: Session['scopes'];
    plans: GeneratedFile[];
    rootProject: NonSharedBuffer;
    rootConfiguration: NonSharedBuffer;
    [Symbol.asyncDispose](): Promise<void>;
};
