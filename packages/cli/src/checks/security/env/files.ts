import { indexedPaths } from '#cli/repository/tracked.ts';
import type { EngineInput, Finding } from '#cli/types/checks/checks.ts';
import { isEnvironmentFile } from '#cli/repository/file-classification.ts';

/**
 * One finding for each tracked environment file that is not a template.
 * @param input the engine input
 * @returns the findings
 */
export function envFiles(input: EngineInput): Finding[] {
    const tracked = indexedPaths(input.root);
    return tracked.filter(isEnvironmentFile).map((path) => ({
        check: input.spec.name,
        file: path,
        line: 1,
        rule: 'tracked-environment-file',
        message: `${path} is tracked; an environment file holds the values of one machine.`,
        fixable: false,
    }));
}
