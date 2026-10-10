// Build sandbox policy and report public validation failures.
import { GspotError } from '#cli/platform/public.ts';
import { parseStrictPolicy } from '#cli/policy/public.ts';
import { REPORT_PROGRAM } from '#tests/config/samples/commands.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import type { PolicyOptions, ReportingCheck, ReportingCheckOptions } from '#tests/types/harness/policy.ts';

/**
 * Build policy with explicit configuration choices and authored TOML tables.
 * @param configurations the built-in setups selected by the sandbox
 * @param options the level, authored tables, and opt-in to public agent-rule defaults
 * @returns the sandbox's gspot.toml bytes
 */
export function buildPolicy(configurations: string[], options: PolicyOptions = {}): string {
    const selected = configurations.map((configuration) => JSON.stringify(configuration)).join(', ');
    const chosen = options.level === undefined ? '' : `level = "${options.level}"\n`;
    return `${chosen}configurations = [${selected}]\n${options.tables ?? ''}${options.agentRules === true ? '' : '\n[agent_rules]\nenabled = false\n'}`;
}

/**
 * Parses a policy text and returns its errors, or none when it parses.
 * @param text the gspot.toml text
 * @param root the repository the policy describes, when a problem depends on the tree
 * @returns the problem messages
 */
export function policyFindings(text: string, root?: string): string[] {
    try {
        parseStrictPolicy(text, root);
        return [];
    } catch (error) {
        if (error instanceof GspotError && error.code === 'policy') return error.errors;
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

/**
 * Build a check that reports each selected path and fails.
 * @param options the selected paths and check stage.
 * @returns the native command and its line output contract.
 */
export function reportingCheck(options: ReportingCheckOptions): ReportingCheck {
    return {
        command: [process.execPath, '-e', REPORT_PROGRAM, '{files}'],
        ...options,
        output: { format: 'lines' },
    };
}
