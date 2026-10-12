import { findingAt } from '#cli/checks/finding.ts';
import type { Finding, CheckInput } from '#cli/types/execution/check.ts';
import { installedDependency } from '#cli/repository/dependency-files.ts';
import { packageJsonFiles } from '#cli/checks/general/dependencies/package-json.ts';

/**
 * Compare installed versions of declared packages that ship together.
 * @param input the source projects and the selected check.
 * @param pairs the packages the configuration pairs.
 * @returns one finding for each installed version mismatch.
 */
export function versionPairs(input: CheckInput, pairs: readonly (readonly [string, string])[]): Finding[] {
    return [...packageJsonFiles(input)].flatMap(([path, parsed]) => {
        const dependencies = { ...parsed.devDependencies, ...parsed.dependencies };
        return pairs.flatMap(([left, right]) => {
            if (dependencies[left] === undefined || dependencies[right] === undefined) return [];
            const leftVersion = installedDependency(input.root, path, left)?.version;
            const rightVersion = installedDependency(input.root, path, right)?.version;
            if (leftVersion === undefined || rightVersion === undefined || leftVersion === rightVersion) return [];
            return [
                findingAt(
                    input,
                    { file: path, line: 1 },
                    'version-pair',
                    `${left} is ${leftVersion} and ${right} is ${rightVersion}. Move ${left} and ${right} to the same version.`,
                ),
            ];
        });
    });
}
