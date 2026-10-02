import { findingAt } from '#cli/execution/finding.ts';
import { indexedPaths } from '#cli/repository/tracked.ts';
import { isEnvironmentFile } from '#cli/repository/kind.ts';
import type { Finding, EngineInput } from '#cli/types/execution/execution.ts';

/**
 * One finding for each tracked environment file that is not a template.
 * @param input the engine input
 * @returns the findings
 */
export function envFiles(input: EngineInput): Finding[] {
    const tracked = indexedPaths(input.root);
    return tracked
        .filter(isEnvironmentFile)
        .map((path) =>
            findingAt(
                input,
                { file: path, line: 1 },
                'tracked-env',
                `${path} is tracked; an environment file holds the values of one machine.`,
            ),
        );
}
