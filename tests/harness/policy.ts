// Build sandbox policy and report public validation failures.
import { GspotError } from '#cli/platform/errors.ts';
import { parseStrictPolicy } from '#cli/policy/read.ts';
import type { PolicyOptions } from '#tests/types/harness/policy.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';

/**
 * Build policy with explicit configuration choices and authored TOML tables.
 * @param configurations the built-in setups selected by the sandbox
 * @param options the level and tables, when the sandbox changes the public defaults
 * @returns the sandbox's gspot.toml bytes
 */
export function buildPolicy(configurations: string[], options: PolicyOptions = {}): string {
    const selected = configurations.map((configuration) => JSON.stringify(configuration)).join(', ');
    const chosen = options.level === undefined ? '' : `level = "${options.level}"\n`;
    return `${chosen}configurations = [${selected}]\n${options.tables ?? ''}`;
}

/**
 * Parses a policy text and returns its problems, or none when it parses.
 * @param text the gspot.toml text
 * @param root the repository the policy describes, when a problem depends on the tree
 * @returns the problem messages
 */
export function policyProblems(text: string, root?: string): string[] {
    try {
        parseStrictPolicy(text, root);
        return [];
    } catch (error) {
        if (error instanceof GspotError && error.code === 'policy') return error.problems;
        throw error;
    }
}

/** Return the general configurations every repository selects without detection conditions. */
export function alwaysSelectedConfigurations(): string[] {
    return [...configurationManifests().values()]
        .filter(
            ({ configuration }) =>
                configuration.kind === 'general' && configuration.always_selected && configuration.when === undefined,
        )
        .map(({ configuration }) => configuration.name);
}
