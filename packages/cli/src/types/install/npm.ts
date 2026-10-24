import type { PackageManager } from '#cli/types/repository/npm/package-manager.ts';

export type PackageManagerCommand = {
    runFolder: string;
    packageManager: PackageManager;
    commandArguments: string[];
    failure: string;
};

export type PackageManagerRun = {
    env: Record<string, string>;
    credentials: string[];
};

export type BunPackage = [identity: string, address: string, metadata: Record<string, unknown>, integrity: string];

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
    private: true;
    devDependencies: Record<string, string>;
};

export type YarnSetting = { key: string };
