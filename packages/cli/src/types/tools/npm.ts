import type { ToolPin } from '#cli/types/parsers/tool.ts';
import type { SpawnResult } from '#cli/types/platform/runtime.ts';
import type { PackageInstaller } from '#cli/types/parsers/packages.ts';

/** The repository and generated Yarn settings used during package lockfile resolution. */
export type PackagePreparation = { root: string; yarn: string | undefined };
/** The repository and declared native wrappers verified before installing the package project. */
export type PackageInstallation = { root: string; tools: Iterable<ToolPin> };

export type PackageExecution = {
    work: string;
    installer: PackageInstaller;
    env: Record<string, string>;
};

/** The isolated execution and secrets retained for validating native output. */
export type PackageRun = { execution: PackageExecution; credentials: string[]; result: SpawnResult };
