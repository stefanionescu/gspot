import { findingAt } from '#cli/checks/finding.ts';
import { parseJsonFile } from '#cli/parsers/json.ts';
import { findLockfile } from '#cli/repository/classify.ts';
import { readCachedBytes } from '#cli/system/files/reads.ts';
import { packageJsonSchema } from '#cli/parsers/dependency-files.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/dependency-files.ts';
import type { Finding, CheckInput } from '#cli/types/execution/check.ts';
import type { PackageJson } from '#cli/types/parsers/dependency-files.ts';

function rootFindings(input: CheckInput, root: PackageJson | undefined): Finding[] {
    if (root === undefined) return [];
    const findings: Finding[] = [];
    if (root.packageManager === undefined)
        findings.push(
            findingAt(
                input,
                { file: PACKAGE_JSON, line: 1 },
                'package-manager',
                'The root package.json names no packageManager.',
            ),
        );
    return findings;
}

function lockfileFindings(input: CheckInput): Finding[] {
    const kinds = new Map<string, string>();
    for (const file of input.files) {
        const lockfile = findLockfile(file.path);
        const kind =
            lockfile !== undefined && 'configuration' in lockfile && lockfile.configuration === 'javascript'
                ? lockfile.client
                : undefined;
        if (kind !== undefined && !kinds.has(kind)) kinds.set(kind, file.path);
    }
    if (kinds.size <= 1) return [];
    const listed = kinds.values().toArray().join(', ');
    return kinds
        .values()
        .toArray()
        .slice(1)
        .map((path) =>
            findingAt(
                input,
                { file: path, line: 1 },
                'foreign-lockfile',
                `The repository holds lockfiles of ${String(kinds.size)} package managers: ${listed}. Keep one.`,
            ),
        );
}

/**
 * Check the root package manager and selected lockfiles.
 * @param input the check input.
 * @returns the findings.
 */
export function packageJson(input: CheckInput): Finding[] {
    const root = input.files.find(({ kind, path }) => kind === 'source' && path === PACKAGE_JSON);
    const manifest =
        root === undefined
            ? undefined
            : parseJsonFile(
                  PACKAGE_JSON,
                  readCachedBytes(input.reads, PACKAGE_JSON).toString('utf8'),
                  packageJsonSchema,
              );
    return [...rootFindings(input, manifest), ...lockfileFindings(input)];
}
