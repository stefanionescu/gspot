import { parseJsonFile } from '#cli/parsers/json.ts';
import { buildFinding } from '#cli/checks/finding.ts';
import { readCachedBytes } from '#cli/system/files/reads.ts';
import { packageJsonSchema } from '#cli/parsers/dependency-files.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/dependency-files.ts';
import type { Finding, CheckInput } from '#cli/types/checks/run/check.ts';
import type { PackageJson } from '#cli/types/parsers/dependency-files.ts';

function checkRootPackage(input: CheckInput, root: PackageJson | undefined): Finding[] {
    if (root === undefined) return [];
    const findings: Finding[] = [];
    if (root.packageManager === undefined)
        findings.push(
            buildFinding(
                input,
                { file: PACKAGE_JSON, line: 1 },
                'package-manager',
                'The root package.json names no packageManager.',
            ),
        );
    return findings;
}

/**
 * Check the package manager that the root package.json declares.
 * @param input the selected manifests, lockfile paths, and repository settings.
 * @returns the findings.
 */
export function checkPackageJson(input: CheckInput): Finding[] {
    const root = input.files.find(({ kind, path }) => kind === 'source' && path === PACKAGE_JSON);
    const manifest =
        root === undefined
            ? undefined
            : parseJsonFile(
                  PACKAGE_JSON,
                  readCachedBytes(input.reads, PACKAGE_JSON).toString('utf8'),
                  packageJsonSchema,
              );
    return checkRootPackage(input, manifest);
}
