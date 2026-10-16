import type { Session } from '#cli/types/planning.ts';
import type { NpmRegistry } from '#tests/types/e2e.ts';
import type { ToolDeclaration } from '#cli/types/configurations.ts';

/** A package project in a sandbox: the project, its local registry, and the files the install reads. */
export type NpmClientSandbox = {
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
