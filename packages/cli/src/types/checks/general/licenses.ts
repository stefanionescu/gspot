import type { z } from 'zod';
import type { ConfigurationTables } from '#cli/types/settings/tables.ts';
import type { pythonLicenseOutputSchema } from '#cli/schemas/checks/general/licenses.ts';

export type LicensedPackage = { name: string; license: string };

export type AllowedPackage = ConfigurationTables['licenses']['allowed_package'][number];

export type ProjectLicenses = {
    dependencyFile: string;
    packages: LicensedPackage[];
    locked: string[];
    ecosystem: 'npm' | 'python';
    settings: ConfigurationTables['licenses'];
};

export type PythonLicenseOutput = z.infer<typeof pythonLicenseOutputSchema>[number];
