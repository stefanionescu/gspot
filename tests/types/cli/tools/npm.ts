import type { PackageInstaller } from '#cli/types/parsers/packages.ts';

/** Generated settings and native lock operations for one supported Yarn version. */
export type YarnOperations = {
    installer: PackageInstaller;
    lock: string[];
    install: string[];
    settings: boolean;
};
