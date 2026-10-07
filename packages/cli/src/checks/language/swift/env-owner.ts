import { findingAt } from '#cli/checks/finding.ts';
import { visitSwiftSources } from '#cli/parsers/swift.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import { rolePaths } from '#cli/policy/settings/lookup.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { ENVIRONMENT_READ } from '#cli/config/checks/language/swift.ts';

/**
 * Report process environment reads outside the declared owner; skip when no owner is declared.
 * @param input the selected scope, files, and policy settings
 * @returns one finding for each reading line outside those paths
 */
export async function envOwner(input: CheckInput): Promise<Finding[]> {
    const owners = rolePaths(input.policyFiles.policy.architecture.roles, 'env');
    if (owners.length === 0) return [];
    const isOwner = pathMatcher(owners);
    return visitSwiftSources(input, ({ sources }) =>
        sources.flatMap((source) => {
            if (isOwner(source.path)) return [];
            const lines = new Set(
                source.tree.rootNode
                    .descendantsOfType('navigation_expression')
                    .filter((node) => node.text.replaceAll(/\s+/gu, '') === ENVIRONMENT_READ)
                    .map((node) => node.startPosition.row + 1),
            );
            return [...lines].map((line) =>
                findingAt(
                    input,
                    { file: source.path, line },
                    'read-outside-owner',
                    'The process environment is read here, outside the environment owner. Read it there and pass the value in.',
                ),
            );
        }),
    );
}
