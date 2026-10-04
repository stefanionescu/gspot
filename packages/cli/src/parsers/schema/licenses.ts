import { z } from 'zod';

const licenseSchema = z.object({ licenses: z.union([z.string(), z.array(z.string())]).optional() });

export const reportSchema = z.record(z.string(), licenseSchema);

export const pythonReportSchema = z.array(
    z.object({ Name: z.string().min(1), Version: z.string().min(1), License: z.string().min(1) }),
);

/** A package and exact version exempted from the allowed licenses with an authored reason. */
export const licenseExceptionSchema = z.strictObject({
    package: z
        .string()
        .regex(/^(?:@[^/@\s]+\/[^/@\s]+|[^/@\s]+)@\d[^\s@<>=~^*|,]*$/u, 'Name a package and its exact version.'),
    license: z.string().min(1),
    reason: z.string().min(1),
});

export const allowlistSchema = z.object({
    allowed: z.array(z.string().min(1)),
    exceptions: z.array(licenseExceptionSchema),
});
