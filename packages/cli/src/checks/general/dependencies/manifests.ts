import { posix } from 'node:path';
import { findingAt } from '#cli/execution/finding.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import { readPackageManifest } from '#cli/repository/packages.ts';
import type { PackageManifest } from '#cli/types/repository/repository.ts';
import type { Finding, EngineInput } from '#cli/types/execution/execution.ts';

import {
    LOCKFILES,
    NPM_MANIFEST,
    EXACT_VERSION,
    DEPENDENCY_TABLES,
    NON_REGISTRY_VERSION,
} from '#cli/config/checks/general/dependencies.ts';

function rootFindings(input: EngineInput, root: PackageManifest | undefined): Finding[] {
    if (root === undefined) return [];
    const findings: Finding[] = [];
    if (root.packageManager === undefined)
        findings.push(
            findingAt(
                input,
                { file: NPM_MANIFEST, line: 1 },
                'package-manager',
                'The root package.json names no packageManager.',
            ),
        );
    if (root.workspaces !== undefined && root.private !== true)
        findings.push(
            findingAt(
                input,
                { file: NPM_MANIFEST, line: 1 },
                'private-root',
                'A workspace root is private, so nobody publishes it by accident.',
            ),
        );
    return findings;
}

function installerFindings(input: EngineInput, manifests: Map<string, PackageManifest>): Finding[] {
    const root = manifests.get(NPM_MANIFEST);
    const wanted = root?.packageManager;
    const differing = manifests
        .entries()
        .filter(([, manifest]) => wanted !== undefined && (manifest.packageManager ?? wanted) !== wanted)
        .toArray();
    return [
        ...rootFindings(input, root),
        ...differing.map(([path, manifest]) =>
            findingAt(
                input,
                { file: path, line: 1 },
                'package-manager',
                `This package names ${manifest.packageManager ?? ''}; the root names ${wanted ?? ''}.`,
            ),
        ),
    ];
}

function lockfileFindings(input: EngineInput): Finding[] {
    const kinds = new Map<string, string>();
    for (const file of input.files) {
        const kind = LOCKFILES[posix.basename(file.path)];
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
 * The findings of the manifest policy over every tracked package.json.
 * @param input the engine input
 * @returns the findings
 */
export function manifestPolicy(input: EngineInput): Finding[] {
    const allowed = (input.view.tool('dependencies')['ranges_allowed'] as { paths: string[] }[] | undefined) ?? [];
    const isRangeAllowed = pathMatcher(allowed.flatMap((entry) => entry.paths));
    const manifests = new Map<string, PackageManifest>();
    for (const file of input.files) {
        if (file.kind !== 'source') continue;
        if (file.path !== NPM_MANIFEST && !file.path.endsWith(`/${NPM_MANIFEST}`)) continue;
        manifests.set(file.path, readPackageManifest(input.root, file.path));
    }
    const ranges = [...manifests].flatMap(([path, manifest]) => {
        if (isRangeAllowed(path)) return [];
        return DEPENDENCY_TABLES.flatMap((table) =>
            Object.entries(manifest[table] ?? {})
                .filter(([, version]) => !EXACT_VERSION.test(version) && !NON_REGISTRY_VERSION.test(version))
                .map(([name, version]) =>
                    findingAt(
                        input,
                        { file: path, line: 1 },
                        'version-range',
                        `${name} is "${version}" under ${table}; pin the exact version the lockfile holds.`,
                    ),
                ),
        );
    });
    return [...ranges, ...installerFindings(input, manifests), ...lockfileFindings(input)];
}
