import { z } from 'zod';

const licenseSchema = z.object({
    licenses: z.union([z.string(), z.string().array()]).optional(),
});

export const javascriptLicenseOutputSchema = z.record(z.string(), licenseSchema);

export const pythonLicenseOutputSchema = z
    .object({
        Name: z.string().min(1),
        Version: z.string().min(1),
        'License-Expression': z.string().optional(),
        'License-Metadata': z.string().optional(),
        'License-Classifier': z.string().optional(),
    })
    .array();
