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

export type PackageManagerArguments = { lockfile: string[]; install: string[] };

export type BunPackage = [identity: string, address: string, metadata: Record<string, unknown>, integrity: string];

export type ToolPackageJson = {
    private: true;
    devDependencies: Record<string, string> & { '@next/eslint-plugin-next'?: string | undefined };
};

export type YarnSetting = { key: string };
