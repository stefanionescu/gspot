import type { ConfigurationTables } from '#cli/types/settings/configuration-tables.ts';

export type LicensedPackage = { name: string; license: string };

/** Installed dependency licenses associated with the project that owns them. */
export type ProjectLicenses = {
    dependencyFile: string;
    packages: LicensedPackage[];
    packageKey: (name: string) => string;
    configuration: ConfigurationTables['licenses'];
};
