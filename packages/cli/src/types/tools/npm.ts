import type { FileCopy } from '#cli/types/platform/root.ts';
import type { SpawnResult } from '#cli/types/platform/runtime.ts';
import type { PackageInstaller } from '#cli/types/parsers/packages.ts';

export type InstallFiles = { project: FileCopy; recorded: FileCopy; yarn: FileCopy | undefined };

export type PackageExecution = {
    work: string;
    installer: PackageInstaller;
    env: Record<string, string>;
};

/** The isolated execution and secrets retained for validating native output. */
export type PackageRun = { execution: PackageExecution; credentials: string[]; result: SpawnResult };
