import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';

import {
    type PythonLicenseReport,
    type JavascriptLicenseReport,
    type JavascriptPackageLicense,
} from '#cli/types/checks/licenses.ts';

const licenseSchema = z.object({
    licenses: z.union([z.string(), z.array(z.string())]).optional(),
} satisfies SchemaShape<JavascriptPackageLicense>) satisfies z.ZodType<JavascriptPackageLicense>;

export const javascriptReportSchema = z.record(z.string(), licenseSchema) satisfies z.ZodType<JavascriptLicenseReport>;

export const pythonReportSchema = z.array(
    z.object({
        Name: z.string().min(1),
        Version: z.string().min(1),
        'License-Expression': z.string().optional(),
        'License-Metadata': z.string().optional(),
        'License-Classifier': z.string().optional(),
    } satisfies SchemaShape<PythonLicenseReport>),
) satisfies z.ZodType<PythonLicenseReport[]>;
