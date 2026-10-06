import { z } from 'zod';
import { isRecord } from '#cli/platform/objects.ts';
import type { Reasoned, ReasonedSchema } from '#cli/types/policy/settings.ts';

/**
 * Identifies the validated value-and-reason form without treating other setting tables as wrappers.
 * @param value the parsed setting.
 * @returns whether the setting carries a value and optional reason.
 */
export function isReasoned(value: unknown): value is Reasoned<unknown> {
    return (
        isRecord(value) &&
        'value' in value &&
        Object.keys(value).every((key) => key === 'value' || key === 'reason') &&
        (value['reason'] === undefined || typeof value['reason'] === 'string')
    );
}

/**
 * Accepts a setting directly or paired with an exception reason.
 * @param inner the schema for the setting value.
 * @returns the schema for either supported setting form.
 */
export const reasoned = <T extends z.ZodType>(inner: T): ReasonedSchema<T> =>
    z.union([inner, z.strictObject({ value: inner, reason: z.string() })]);

/** Per-language naming limits and spelling styles. Entries can carry an authored reason. */
export const namingCategorySchema = z.strictObject({
    max_chars: reasoned(z.number()).optional(),
    max_words: reasoned(z.number()).optional(),
    case: reasoned(z.array(z.string())).optional(),
});
