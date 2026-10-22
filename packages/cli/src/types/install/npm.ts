import type { PackageManager } from '#cli/types/repository/npm/package-manager.ts';

/** One package-manager operation with its repository routing. */
export type PackageManagerCommand = {
    runFolder: string;
    packageManager: PackageManager;
    commandArguments: string[];
    failure: string;
};

/** The private routing environment and credentials of a package manager run. */
export type PackageManagerRun = {
    env: Record<string, string>;
    credentials: string[];
};

/** The lockfile and install arguments for the major version of a package manager. */
export type PackageManagerArguments = { lockfile: string[]; install: string[] };

/** One package entry in a Bun lockfile. */
export type BunPackage = [identity: string, address: string, metadata: Record<string, unknown>, integrity: string];

/** The generated npm project file. */
export type ToolPackageJson = {
    private: true;
    devDependencies: Record<string, string> & { '@next/eslint-plugin-next'?: string | undefined };
};

export type YarnSetting = { key: string };
