import type { Read } from '#cli/types/platform/root.ts';
import type { SpawnResult } from '#cli/types/platform/runtime.ts';
import type { PackageInstaller } from '#cli/types/parsers/packages.ts';

export type InstallFiles = { project: Read; recorded: Read; yarn: Read | undefined };

export type PackageExecution = {
    work: string;
    installer: PackageInstaller;
    env: Record<string, string>;
};

/** The isolated execution and secrets retained for validating native output. */
export type PackageRun = { execution: PackageExecution; credentials: string[]; result: SpawnResult };
