import { z } from 'zod';

const buildSchema = z.object({
    context: z.string().optional(),
    dockerfile: z.string().optional(),
});

const serviceSchema = z.object({
    image: z.string().min(1).optional(),
    build: z.union([z.string().transform((context) => ({ context, dockerfile: undefined })), buildSchema]).optional(),
});

export const composeSchema = z.object({
    services: z.record(z.string(), serviceSchema).optional(),
});

const vulnerabilitySchema = z.object({
    VulnerabilityID: z.string().min(1),
    PkgName: z.string().min(1),
});

const secretSchema = z.object({ RuleID: z.string().min(1), Title: z.string().min(1) });

export const trivyImageOutputSchema = z.object({
    Results: z
        .object({
            Vulnerabilities: vulnerabilitySchema.array().optional(),
            Secrets: secretSchema.array().optional(),
        })
        .array()
        .optional(),
});
