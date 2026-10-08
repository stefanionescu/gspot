import { findingAt } from '#cli/checks/finding.ts';
import { readSource } from '#cli/platform/source.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { parsePackageManifest } from '#cli/parsers/packages.ts';
import { installedDependencyVersion } from '#cli/repository/manifests.ts';

/**
 * Compare installed versions of declared packages that ship together.
 * @param input the source projects and the selected check.
 * @param pairs the packages the configuration pairs.
 * @returns one finding for each installed version mismatch.
 */
export function versionPairs(input: CheckInput, pairs: [string, string][]): Finding[] {
    return input.files
        .filter(({ path, kind }) => kind === 'source' && (path === 'package.json' || path.endsWith('/package.json')))
        .flatMap(({ path }) => {
            const parsed = parsePackageManifest(readSource(input.root, path, input.reads).toString('utf8'), path);
            const dependencies = { ...parsed.devDependencies, ...parsed.dependencies };
            return pairs.flatMap(([left, right]) => {
                if (dependencies[left] === undefined || dependencies[right] === undefined) return [];
                const leftVersion = installedDependencyVersion(input.root, path, left);
                const rightVersion = installedDependencyVersion(input.root, path, right);
                if (leftVersion === undefined || rightVersion === undefined || leftVersion === rightVersion) return [];
                return [
                    findingAt(
                        input,
                        { file: path, line: 1 },
                        'version-pair',
                        `${left} is ${leftVersion} and ${right} is ${rightVersion}. Install the same version of both packages.`,
                    ),
                ];
            });
        });
}
