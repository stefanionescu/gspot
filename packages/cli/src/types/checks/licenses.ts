import type { ConfigurationTables } from '#cli/types/settings/configuration-tables.ts';

export type LicensedPackage = { name: string; license: string };

/** One allowed-package record: a package name or glob, a version, range, or `*`, and the reason. */
export type AllowedPackage = ConfigurationTables['licenses']['allowed_package'][number];

/** Locked dependency licenses associated with the project that owns them. */
export type ProjectLicenses = {
    dependencyFile: string;
    packages: LicensedPackage[];
    /** Every package the lockfile holds, as `name@version`, including optional builds for other platforms. */
    locked: string[];
    packageKey: (name: string) => string;
    configuration: ConfigurationTables['licenses'];
};
