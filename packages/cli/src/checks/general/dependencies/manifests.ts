import { posix } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { lockfileEntry } from '#cli/parsers/lockfiles.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { readPackageManifest } from '#cli/repository/manifests.ts';
import type { PackageManifest } from '#cli/types/parsers/packages.ts';
import { NPM_MANIFEST, JAVASCRIPT_CLIENTS } from '#cli/config/checks/general/dependencies.ts';

function rootFindings(input: CheckInput, root: PackageManifest | undefined): Finding[] {
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

function packageClientFindings(input: CheckInput, manifests: Map<string, PackageManifest>): Finding[] {
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

function lockfileFindings(input: CheckInput): Finding[] {
    const kinds = new Map<string, string>();
    for (const file of input.files) {
        const kind = lockfileEntry(posix.basename(file.path))?.client;
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
 * @param input the check input
 * @returns the findings
 */
export function manifests(input: CheckInput): Finding[] {
    const manifests = new Map<string, PackageManifest>();
    for (const file of input.files) {
        if (file.kind !== 'source') continue;
        if (file.path !== NPM_MANIFEST && !file.path.endsWith(`/${NPM_MANIFEST}`)) continue;
        const manifest = readPackageManifest(input.root, file.path);
        if (manifest === undefined) throw new Error(`Manifest is missing: ${file.path}`);
        manifests.set(file.path, manifest);
    }
    return [
        ...rootFindings(input, manifests.get(NPM_MANIFEST)),
        ...packageClientFindings(input, manifests),
        ...lockfileFindings(input),
    ];
}
