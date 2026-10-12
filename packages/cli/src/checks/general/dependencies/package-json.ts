import { posix } from 'node:path';
import { readJson } from '#cli/parsers/json.ts';
import { findingAt } from '#cli/checks/finding.ts';
import { readSource } from '#cli/system/file-reads.ts';
import { lockfileEntry } from '#cli/parsers/lockfiles.ts';
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
    if (root.workspaces !== undefined && root.private !== true)
        findings.push(
            findingAt(
                input,
                { file: PACKAGE_JSON, line: 1 },
                'private-root',
                'This workspace root is not private. Set "private": true to prevent accidental publication.',
            ),
        );
    return findings;
}

function packageClientFindings(input: CheckInput, manifests: Map<string, PackageJson>): Finding[] {
    const root = manifests.get(PACKAGE_JSON);
    const wanted = root?.packageManager;
    if (wanted === undefined) return [];
    return [...manifests].flatMap(([path, manifest]) => {
        const declared = manifest.packageManager;
        if (declared === undefined || declared === wanted) return [];
        return [
            findingAt(
                input,
                { file: path, line: 1 },
                'package-manager',
                `This package names ${declared}; the root names ${wanted}.`,
            ),
        ];
    });
}

function lockfileFindings(input: CheckInput): Finding[] {
    const kinds = new Map<string, string>();
    for (const file of input.files) {
        const lockfile = lockfileEntry(posix.basename(file.path));
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
 * Read the source package.json files selected for this check.
 * @param input the selected files and this run's read cache.
 * @returns parsed package fields by repository-relative path.
 */
export function packageJsonFiles(input: CheckInput): Map<string, PackageJson> {
    return new Map(
        input.files
            .filter(
                ({ kind, path }) => kind === 'source' && (path === PACKAGE_JSON || path.endsWith(`/${PACKAGE_JSON}`)),
            )
            .map(({ path }) => [
                path,
                readJson(path, readSource(input.root, path, input.reads).toString('utf8'), packageJsonSchema),
            ]),
    );
}

/**
 * Check the package settings of every selected source package.json.
 * @param input the check input.
 * @returns the findings.
 */
export function packageJson(input: CheckInput): Finding[] {
    const manifests = packageJsonFiles(input);
    return [
        ...rootFindings(input, manifests.get(PACKAGE_JSON)),
        ...packageClientFindings(input, manifests),
        ...lockfileFindings(input),
    ];
}
