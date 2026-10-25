import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';

import {
    type PythonLicenseOutput,
    type JavascriptLicenseOutput,
    type JavascriptPackageLicense,
} from '#cli/types/checks/general/licenses.ts';

const licenseSchema = z.object({
    licenses: z.union([z.string(), z.string().array()]).optional(),
} satisfies SchemaShape<JavascriptPackageLicense>);

export const javascriptReportSchema = z.record(z.string(), licenseSchema) satisfies z.ZodType<JavascriptLicenseOutput>;

export const pythonReportSchema = z
    .object({
        Name: z.string().min(1),
        Version: z.string().min(1),
        'License-Expression': z.string().optional(),
        'License-Metadata': z.string().optional(),
        'License-Classifier': z.string().optional(),
    } satisfies SchemaShape<PythonLicenseOutput>)
    .array() satisfies z.ZodType<PythonLicenseOutput[]>;
