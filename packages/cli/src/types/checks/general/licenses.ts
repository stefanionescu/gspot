import type { z } from 'zod';
import type { CheckInput } from '#cli/types/execution/check.ts';
import type { allowlistSchema } from '#cli/parsers/schema/licenses.ts';

export type LicensedPackage = { name: string; license: string };

export type LicenseException = z.infer<typeof allowlistSchema>['exceptions'][string];

/** Allowed package licenses and explicitly reasoned exceptions from generated policy. */
export type LicenseAllowlist = z.infer<typeof allowlistSchema>;

/** Installed dependency licenses associated with the project that owns them. */
export type ProjectLicenses = {
    manifest: string;
    packages: LicensedPackage[];
    packageKey: (name: string) => string;
    configuration: LicenseAllowlist;
};

/** The installed scanner and package identity convention of one project format. */
export type LicenseScanner = {
    scan: (input: CheckInput, start: string) => Promise<LicensedPackage[]>;
    packageKey: (name: string) => string;
};
