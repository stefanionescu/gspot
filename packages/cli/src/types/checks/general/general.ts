import type { z } from 'zod';
import type { NumberedLine } from '#cli/types/text.ts';
import type { ConfigurationTables } from '#cli/types/settings/tables.ts';
import type { pythonLicenseOutputSchema } from '#cli/schemas/checks/general.ts';

export type TaskNames = { mise: Set<string>; scripts: Set<string>; binaries: Set<string> };

export type PathIndex = {
    paths: Set<string>;
    isIgnored: (path: string) => boolean;
    tasks: TaskNames;
};

export type ProseLine = NumberedLine & { command: boolean };

export type SuppressionSyntax = {
    covered: ReadonlySet<string>;
    tool: string;
    marker: RegExp;
    inlineMarker: RegExp;
    extractReason: (text: string) => string | undefined;
    forbidden: boolean;
    separator: RegExp | undefined;
    allRules: RegExp | undefined;
    limitRules: RegExp | undefined;
};

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

export type ProseRoute = { path: string; mode: 'path' | 'stdin'; extension: string };

export type ProseRouteBatch = [ProseRoute, ...ProseRoute[]];

export type ValeAlert = { file: string; line: number; column: number; check: string; message: string };
