// git tracks no environment file except the templates.
import { git } from '#cli/platform/spawn.ts';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { pathMatcher } from '#cli/presets/claims.ts';
import { ENV_FILE_PATTERNS, ENV_TEMPLATE_NAMES } from '#config/env-files.ts';

/**
 * One finding for each tracked environment file that is not a template.
 * @param input the engine input
 * @returns the findings
 */
export function envFiles(input: EngineInput): Promise<Finding[]> {
    const isEnvironmentFile = pathMatcher(ENV_FILE_PATTERNS.map((pattern) => `**/${pattern}`));
    const tracked = (git(input.root, ['ls-files', '--cached', '-z']) ?? '').split('\0').filter((path) => path !== '');
    const findings = tracked
        .filter(
            (path) => isEnvironmentFile(path) && !ENV_TEMPLATE_NAMES.includes(path.slice(path.lastIndexOf('/') + 1)),
        )
        .map((path) => ({
            check: input.spec.id,
            file: path,
            line: 1,
            rule: 'tracked-environment-file',
            message: `${path} is tracked; an environment file holds the values of one machine.`,
            fixable: false,
        }));
    return Promise.resolve(findings);
}
