import type { PackageInstaller } from '#cli/types/parsers/packages.ts';

/** Generated settings and native lockfile creation for one supported Yarn version. */
export type YarnOperations = {
    installer: PackageInstaller;
    lockfile: string[];
    install: string[];
    settings: boolean;
};
