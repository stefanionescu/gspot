import { z } from 'zod';

export const relativeDirectory = z
    .string()
    .min(1)
    .regex(
        /^(?!\/)(?![\s\S]*(?:^|\/)\.\.(?:\/|$))[^\\:\p{Cc}]+$/u,
        'Use a relative path with forward slashes, without parent traversal or a drive prefix.',
    );

/**
 * Accepts a setting directly or paired with an exception reason.
 * @param inner the schema for the setting value
 * @returns the schema for either supported setting form
 */
export const reasoned = <T extends z.ZodType>(
    inner: T,
): z.ZodUnion<[T, z.ZodObject<{ value: T; reason: z.ZodString }, z.core.$strict>]> =>
    z.union([inner, z.strictObject({ value: inner, reason: z.string() })]);
