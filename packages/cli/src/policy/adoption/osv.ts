import { appendSetting, reasonFor, type CarriedConfiguration } from '#cli/policy/adoption/results.ts';
import type { CarrySource } from '#cli/policy/adoption/source.ts';
import { asList, asRaw, asText } from '#cli/policy/adoption/source.ts';
import { z } from 'zod';

function reviewBy(value: unknown): string | undefined {
    return asText(value) ?? (value instanceof Date ? value.toISOString() : undefined);
}

function carryOsv(source: CarrySource, path: string, lists: CarriedConfiguration): void {
    if (path.includes('/'))
        throw new Error(`${path}: directory-local advisory exceptions require explicit conversion.`);
    const parsed = source.parsed;
    const entries = asList(parsed['IgnoredVulns']);
    for (const value of entries) {
        const entry = asRaw(value);
        if (!entry) continue;
        const until = reviewBy(entry['ignoreUntil']);
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
    carry: carryOsv,
};
