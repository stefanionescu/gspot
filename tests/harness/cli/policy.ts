// The policy text a sandbox starts from, with the level, the kits, and the tables a test adds, and the problems a policy
// text raises.
import { GspotError } from '#cli/platform/errors.ts';
import { parsePolicyText } from '#cli/policy/read.ts';

export function policyOf(kits: string[], extra = '', level?: string): string {
    const selected = kits.map((kit) => JSON.stringify(kit)).join(', ');
    const chosen = level === undefined ? '' : `level = "${level}"\n`;
    return `${chosen}kits = [${selected}]\n${extra}`;
}

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
