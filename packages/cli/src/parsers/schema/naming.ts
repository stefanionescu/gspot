import { z } from 'zod';
import { readAsset } from '#cli/platform/assets.ts';
import type { NamingTerms } from '#cli/types/parsers/naming.ts';
import { NAMING_TERMS_FILE } from '#cli/config/configurations.ts';

const namedReason = z.strictObject({ name: z.string(), reason: z.string().optional() });

const reservedTerm = z.strictObject({ term: z.string(), uses: z.array(z.string()) });

const groupReason = z.strictObject({ group: z.string(), reason: z.string().optional() });

const fixedKeyEntry = z.strictObject({ file: z.string(), names: z.array(z.string()), reason: z.string().optional() });

let shipped: NamingTerms | undefined;

/** A path-specific naming rule shared by policy, manifests, and shipped naming data. */
export const namingRuleSchema = z.strictObject({
    paths: z.array(z.string().min(1)).min(1),
    languages: z.array(z.string()).optional(),
    categories: z.array(z.string()).optional(),
    names: z.array(z.string()).optional(),
    ignored_prefix: z.string().optional(),
    allow_digits: z.boolean().optional(),
    allow_duplicate_words: z.boolean().optional(),
    skip: z.boolean().optional(),
    case: z.array(z.string()).optional(),
    reason: z.string().optional(),
});

/** Naming lists and their defaults, before per-language tables are added. */
export const namingLists = z.object({
    banned: z.array(z.string()).default([]),
    allowed: z.array(namedReason).default([]),
    reserved: z.array(reservedTerm).default([]),
    groups_off: z.array(groupReason).default([]),
    fixed_keys: z.array(fixedKeyEntry).default([]),
    paths: z.array(namingRuleSchema).default([]),
});

/** Built-in naming defaults read by validation and source checks. */
export const shippedNamingSchema = z.strictObject({
    version: z.number().int(),
    matching: z.strictObject({ whole_parts: z.boolean(), case_insensitive: z.boolean() }),
    ban_digits: z.boolean(),
    ban_repeats: z.boolean(),
    groups: z.record(z.string(), z.strictObject({ removable: z.boolean(), terms: z.array(z.string()) })),
    reserved: z.array(reservedTerm),
    allowed: z.array(z.string()),
    languages: z.record(
        z.string(),
        z.strictObject({
            max_chars: z.number(),
            max_words: z.number(),
            acronyms: z.enum(['word', 'initialism', 'lower']),
            categories: z.record(z.string(), z.strictObject({ case: z.array(z.string()) })),
        }),
    ),
    paths: z.array(namingRuleSchema),
});

/**
 * Reads the bundled naming policy once for policy validation and source checks.
 * @returns the shipped naming choices
 */
export function namingTerms(): NamingTerms {
    shipped ??= shippedNamingSchema.parse(JSON.parse(readAsset(NAMING_TERMS_FILE)));
    return shipped;
}
