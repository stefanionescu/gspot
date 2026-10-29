import type { ToolInstall, ToolPackageManager } from '#cli/types/installers/install.ts';

export type NpmToolInstall = ToolInstall & {
    packageManager: ToolPackageManager;
    registryEnvironment: Record<string, string>;
};

export type PackageManagerRequest = {
    runFolder: string;
    packageManager: ToolPackageManager;
    commandArguments: string[];
    failure: string;
    env: Record<string, string>;
};

export type PackageManagerRun = {
    env: Record<string, string>;
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

export type ToolPackageJson = {
    name: 'tools';
    private: true;
    devDependencies: Record<string, string>;
};
