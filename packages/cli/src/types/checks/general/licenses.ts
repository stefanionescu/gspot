import type { ConfigurationTables } from '#cli/types/settings/tables.ts';

export type LicensedPackage = { name: string; license: string };

export type AllowedPackage = ConfigurationTables['licenses']['allowed_package'][number];

export type ProjectLicenses = {
    dependencyFile: string;
    packages: LicensedPackage[];
    locked: string[];
    ecosystem: 'npm' | 'python';
    settings: ConfigurationTables['licenses'];
};

export type PythonLicenseOutput = {
    Name: string;
    Version: string;
    'License-Expression'?: string | undefined;
    'License-Metadata'?: string | undefined;
    'License-Classifier'?: string | undefined;
};

export type JavascriptPackageLicense = { licenses?: string | string[] | undefined };

export type JavascriptLicenseOutput = Record<string, JavascriptPackageLicense>;
