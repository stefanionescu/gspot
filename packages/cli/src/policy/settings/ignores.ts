import { ISO_DATE_LENGTH } from '#cli/config/policy/settings.ts';
import type { Policy, IgnoreEntry } from '#cli/types/policy/settings.ts';

/**
 * Select saved ignores whose expiry date has not arrived.
 * @param policy the repository policy, including inactive ignores
 * @returns the ignores that apply today in UTC
 */
export function activeIgnores(policy: Policy): IgnoreEntry[] {
    const today = new Date().toISOString().slice(0, ISO_DATE_LENGTH);
    return policy.ignores.filter((entry) => entry.until === undefined || today < entry.until);
}
