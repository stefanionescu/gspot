import type { ConfigurationTables } from '#cli/types/settings/configuration-tables.ts';

export type LicensedPackage = { name: string; license: string };

export type AllowedPackage = ConfigurationTables['licenses']['allowed_package'][number];

export type ProjectLicenses = {
    dependencyFile: string;
    packages: LicensedPackage[];
    locked: string[];
    packageKey: (name: string) => string;
    configuration: ConfigurationTables['licenses'];
};
