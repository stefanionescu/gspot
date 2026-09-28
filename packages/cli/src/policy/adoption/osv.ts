import { z } from 'zod';
import { asRaw, asList, asText } from '#cli/policy/adoption/source.ts';
import { reasonFor, appendSetting } from '#cli/policy/adoption/results.ts';
import type { AdoptionResult, ConfigurationSource } from '#cli/types/policy/adoption.ts';

function carryOsv(source: ConfigurationSource, path: string, lists: AdoptionResult): void {
    if (path.includes('/'))
        throw new Error(`${path}: directory-local advisory exceptions require explicit conversion.`);
    const parsed = source.parsed;
    const entries = asList(parsed['IgnoredVulns']);
    for (const value of entries) {
        const entry = asRaw(value);
        if (!entry) continue;
        const expiration = entry['ignoreUntil'];
        const until = asText(expiration) ?? (expiration instanceof Date ? expiration.toISOString() : undefined);
        appendSetting(lists, 'osv', 'ignore', [
            {
                id: String(entry['id']),
                reason: asText(entry['reason']) ?? reasonFor(path),
                ...(until === undefined ? {} : { review_by: until }),
            },
        ]);
    }
}

export const osvImporter = {
    schema: z.strictObject({
        IgnoredVulns: z
            .array(
                z.strictObject({
                    id: z.string(),
                    reason: z.string().optional(),
                    ignoreUntil: z.union([z.string(), z.date()]).optional(),
                }),
            )
            .optional(),
    }),
    keep: carryOsv,
};
