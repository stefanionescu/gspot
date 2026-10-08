import { z } from 'zod';
import { CATEGORY_LABELS } from '#cli/config/parsers/naming.ts';

const identifierCategory = z.enum(Object.keys(CATEGORY_LABELS));

const reservedCategories = z
    .array(identifierCategory)
    .min(1)
    .meta({ description: 'Identifier categories where the term is permitted, such as properties or directories.' });

/** A path-specific naming override shared by policy, manifests, and shipped naming data. */
export const namingOverrideSchema = z.strictObject({
    paths: z.array(z.string().min(1)).min(1),
    languages: z.array(z.string()).optional(),
    categories: z.array(z.string()).optional(),
    names: z.array(z.string()).optional(),
    ignored_prefix: z.string().optional(),
    allow_digits: z.boolean().optional(),
    allow_repeated_words: z.boolean().optional(),
    allowed: z.array(z.string()).optional(),
    case: z.array(z.string()).optional(),
    reason: z.string().optional(),
});

/** Naming lists and their defaults, before per-language tables are added. */
export const namingLists = z.object({
    banned: z.array(z.string()).default([]),
    allowed: z.record(z.string(), z.string()).default({}),
    reserved: z.record(z.string(), reservedCategories).default({}),
    overrides: z.array(namingOverrideSchema).default([]),
});

/** Built-in naming defaults read by validation and source checks. */
export const shippedNamingSchema = z.strictObject({
    version: z.number().int(),
    matching: z.strictObject({ whole_parts: z.boolean(), case_insensitive: z.boolean() }),
    allow_digits: z.boolean(),
    allow_repeated_words: z.boolean(),
    groups: z.record(z.string(), z.strictObject({ terms: z.array(z.string()) })),
    reserved: z.record(z.string(), reservedCategories),
    allowed: z.array(z.string()),
    languages: z.record(
        z.string(),
        z.strictObject({
            acronyms: z.enum(['word', 'initialism', 'lower']),
            categories: z.record(z.string(), z.strictObject({ case: z.array(z.string()) })),
        }),
    ),
    overrides: z.array(namingOverrideSchema),
});
