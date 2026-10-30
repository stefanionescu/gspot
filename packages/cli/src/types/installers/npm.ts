import type { z } from 'zod';
import { type LOCKFILES } from '#cli/config/files/lockfiles.ts';
import type { bunPackageSchema } from '#cli/schemas/installers/npm.ts';
import { type ToolInstall, type ToolPackageManager } from '#cli/types/installers/installers.ts';

export type NpmToolInstall = ToolInstall & {
    packageManager: ToolPackageManager;
    registryEnvironment: Record<string, string>;
};

export type PackageManagerRequest = {
    runFolder: string;
    packageManager: ToolPackageManager;
    commandArguments: string[];
    failure: string;
    environment: Record<string, string>;
};

export type PackageManagerRun = {
    environment: Record<string, string>;
    credentials: string[];
};

export type BunPackage = z.infer<typeof bunPackageSchema>;

export type LockedTarball = { name: string; version: string; address: string; integrity: string };

export type Lockfile = (typeof LOCKFILES)[number];

export type ToolProjectLockfileName = Extract<Lockfile, { toolProject: true }>['file'];
