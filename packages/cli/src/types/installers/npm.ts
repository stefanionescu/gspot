import { type LOCKFILES } from '#cli/config/files/lockfiles.ts';
import { type ToolInstall, type ToolPackageManager } from '#cli/types/installers/install.ts';

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

export type BunPackage = [identity: string, address: string, metadata: Record<string, unknown>, integrity: string];

export type LockedTarball = { name: string; version: string; address: string; integrity: string };

export type NpmPackage = {
    name?: string | undefined;
    version: string;
    resolved?: string | undefined;
    integrity: string;
};

export type PnpmPackage = {
    name?: string | undefined;
    resolution: { integrity: string; tarball?: string | undefined };
};

export type Lockfile = (typeof LOCKFILES)[number];

export type ToolProjectLockfileName = Extract<Lockfile, { toolProject: true }>['file'];
