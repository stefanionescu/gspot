// The problems a policy text raises, for tests that plant a defect and its correction.
import { GspotError } from '#cli/platform/errors.ts';
import { parsePolicyText } from '#cli/policy/read.ts';

/**
 * Parses a policy text and returns its problems, or none when it parses.
 * @param text the gspot.toml text
 * @param root the repository the policy describes, when a problem depends on the tree
 * @returns the problem messages
 */
export function policyProblems(text: string, root?: string): string[] {
    try {
        parsePolicyText(text, 'gspot.toml', root);
        return [];
    } catch (error) {
        if (error instanceof GspotError && error.code === 'policy') return error.problems;
        throw error;
    }
}
