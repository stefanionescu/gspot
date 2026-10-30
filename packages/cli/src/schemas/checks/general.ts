import { z } from 'zod';

export const miseToolsSchema = z.looseObject({
    tools: z.record(z.string(), z.unknown()).default({}),
});

const cloneLocationSchema = z.object({
    name: z.string().min(1),
    start: z.number().int().positive(),
});

export const jscpdOutputSchema = z.object({
    duplicates: z
        .object({
            lines: z.number().int().positive(),
            firstFile: cloneLocationSchema,
            secondFile: cloneLocationSchema,
        })
        .array(),
});

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

const alertSchema = z.object({
    Line: z.number().int().positive(),
    Span: z.tuple([z.number().int().positive(), z.number().int().positive()]),
    Check: z.string().min(1),
    Message: z.string().min(1),
});

export const valeOutputSchema = z.record(z.string().min(1), alertSchema.array());
