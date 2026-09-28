import { z } from 'zod';
// The profile schema retains path-independent policy and adds a profile name and selection mode.
import { policySchema } from '#cli/policy/schema.ts';
import { PATH_KEYS } from '#cli/constants/policy/profiles.ts';

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
export function isRepositoryPath(key: string, value: unknown): boolean {
    return (
        (key === 'adopted' && typeof value === 'object' && value !== null && 'sections' in value) ||
        PATH_KEYS.has(key) ||
        (key === 'module' && typeof value === 'string' && /^(?:\.|\/|\\|[A-Za-z]:)/u.test(value))
    );
}
