// The profile schema retains path-independent policy and adds a profile name and selection mode.
import { z } from 'zod';
import { policySchema } from '#cli/policy/schema.ts';
import { PATH_KEYS } from '#cli/config/policy/profiles.ts';

/** A profile as written. */
export const profileSchema = policySchema
    .omit({ scope: true, generated: true, vendored: true, check: true, exclude: true })
    .extend({
        profile: z.string().min(1),
        selection: z.enum(['exact', 'detect']),
    });

/**
 * Identify repository selectors and local executable registrations that cannot travel in a profile.
 * @param key the policy key
 * @param value the key's value
 * @returns whether the key stays with the repository
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Export and read both ask it; one owner keeps the path test.
export function isRepositoryPath(key: string, value: unknown): boolean {
    return (
        PATH_KEYS.has(key) || (key === 'module' && typeof value === 'string' && /^(?:\.|\/|\\|[A-Za-z]:)/u.test(value))
    );
}
