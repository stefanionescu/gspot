import { posix } from 'node:path';
import { findingAt } from '#cli/execution/finding.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import type { PathAllowance } from '#cli/types/policy/settings.ts';
import { readPackageManifest } from '#cli/repository/manifests.ts';
import type { PackageManifest } from '#cli/types/parsers/packages.ts';
import { LOCKFILE_CLIENTS } from '#cli/config/repository/inventory.ts';
import type { Finding, EngineInput } from '#cli/types/execution/runtime.ts';

import {
    NPM_MANIFEST,
    EXACT_VERSION,
    DEPENDENCY_TABLES,
    JAVASCRIPT_CLIENTS,
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
                'This workspace root is not private. Set "private": true to prevent accidental publication.',
            ),
        );
    return findings;
}

function packageClientFindings(input: EngineInput, manifests: Map<string, PackageManifest>): Finding[] {
    const root = manifests.get(NPM_MANIFEST);
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

function lockfileFindings(input: EngineInput): Finding[] {
    const kinds = new Map<string, string>();
    for (const file of input.files) {
        const kind = LOCKFILE_CLIENTS[posix.basename(file.path)];
        if (kind !== undefined && JAVASCRIPT_CLIENTS.has(kind) && !kinds.has(kind)) kinds.set(kind, file.path);
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
export function manifests(input: EngineInput): Finding[] {
    const allowed = (input.view.options('dependencies')['ranges_allowed'] as PathAllowance[] | undefined) ?? [];
    const isRangeAllowed = pathMatcher(allowed.flatMap((entry) => entry.paths));
    const manifests = new Map<string, PackageManifest>();
    for (const file of input.files) {
        if (file.kind !== 'source') continue;
        if (file.path !== NPM_MANIFEST && !file.path.endsWith(`/${NPM_MANIFEST}`)) continue;
        const manifest = readPackageManifest(input.root, file.path);
        if (manifest === undefined) throw new Error(`Manifest is missing: ${file.path}`);
        manifests.set(file.path, manifest);
    }
    const ranges = [...manifests].flatMap(([path, manifest]) => {
        if (isRangeAllowed(path)) return [];
        return DEPENDENCY_TABLES.flatMap((table) =>
            Object.entries(manifest[table] ?? {})
                .filter(([, version]) => {
                    const declared = version.startsWith('npm:') ? version.slice(version.lastIndexOf('@') + 1) : version;
                    return !EXACT_VERSION.test(declared) && !NON_REGISTRY_VERSION.test(version);
                })
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
    return [
        ...ranges,
        ...rootFindings(input, manifests.get(NPM_MANIFEST)),
        ...packageClientFindings(input, manifests),
        ...lockfileFindings(input),
    ];
}
