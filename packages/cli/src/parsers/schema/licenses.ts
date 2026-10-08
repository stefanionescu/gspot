import { z } from 'zod';
import { GENERATED_JSON_KEY } from '#cli/config/parsers/generated-header.ts';

const licenseSchema = z.object({ licenses: z.union([z.string(), z.array(z.string())]).optional() });

export const reportSchema = z.record(z.string(), licenseSchema);

export const pythonReportSchema = z.array(
    z.object({ Name: z.string().min(1), Version: z.string().min(1), License: z.string().min(1) }),
);

/** An exact installed package identity used as the key of a reviewed exception. */
export const packageIdentitySchema = z
    .string()
    .regex(/^(?:@[^/@\s]+\/[^/@\s]+|[^/@\s]+)@\d[^\s@<>=~^*|,]*$/u, 'Name a package and its exact version.');

/** The license and explanation for one exact installed package. */
export const licenseExceptionSchema = z.strictObject({
    license: z.string().min(1),
    reason: z.string().min(1),
});

export const allowlistSchema = z.strictObject({
    allowed: z.array(z.string().min(1)),
    exceptions: z.record(packageIdentitySchema, licenseExceptionSchema),
});

/** Generated license data carries only the producer's existing metadata besides policy values. */
export const generatedAllowlistSchema = allowlistSchema.extend({ [GENERATED_JSON_KEY]: z.string().optional() });
