import type { EngineInput } from '#cli/types/execution.ts';
import type { Finding } from '#cli/types/reports.ts';
import { pathMatcher } from '#cli/configurations/claims.ts';
// git tracks no environment file except the templates.
import { indexedPaths } from '#cli/repository/tracked.ts';
import { ENV_FILE_PATTERNS, ENV_TEMPLATE_NAMES } from '#cli/repository/env-patterns.ts';

/**
 * One finding for each tracked environment file that is not a template.
 * @param input the engine input
 * @returns the findings
 */
export function envFiles(input: EngineInput): Finding[] {
    const isEnvironmentFile = pathMatcher(ENV_FILE_PATTERNS.map((pattern) => `**/${pattern}`));
    const tracked = indexedPaths(input.root);
    const findings = tracked
        .filter(
            (path) => isEnvironmentFile(path) && !ENV_TEMPLATE_NAMES.includes(path.slice(path.lastIndexOf('/') + 1)),
        )
        .map((path) => ({
            check: input.spec.name,
            file: path,
            line: 1,
            rule: 'tracked-environment-file',
            message: `${path} is tracked; an environment file holds the values of one machine.`,
            fixable: false,
        }));
    return findings;
}
