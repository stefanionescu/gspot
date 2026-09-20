import { z } from 'zod';
// Every package.json: exact versions, one packageManager across the workspace, a private root, one kind of lockfile.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { pathMatcher } from '#cli/presets/claims.ts';
import type { PackageManifest, Reporter } from '#types/integrity.ts';
import { DEPENDENCY_TABLES, EXACT_VERSION, LOCKFILES, NON_REGISTRY_VERSION } from '#config/integrity.ts';

const MANIFEST = 'package.json';

function isManifest(path: string): boolean {
    return path === MANIFEST || path.endsWith(`/${MANIFEST}`);
}

function readManifest(root: string, path: string): PackageManifest {
    try {
        const content: unknown = JSON.parse(readFileSync(join(root, path), 'utf8'));
        return packageManifestSchema.parse(content);
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`Cannot read package manifest ${path}: ${detail}`, { cause: error });
    }
}

function rangeFindings(input: EngineInput, path: string, manifest: PackageManifest): Finding[] {
    return DEPENDENCY_TABLES.flatMap((table) =>
        Object.entries(manifest[table] ?? {})
            .filter(([, version]) => !EXACT_VERSION.test(version) && !NON_REGISTRY_VERSION.test(version))
            .map(([name, version]) => ({
                check: input.spec.id,
                file: path,
                line: 1,
                rule: 'version-range',
                message: `${name} is "${version}" under ${table}; pin the exact version the lockfile holds.`,
                fixable: false,
            })),
    );
}

function rootFindings(report: Reporter, root: PackageManifest | undefined): Finding[] {
    if (root === undefined) return [];
    const findings: Finding[] = [];
    if (root.packageManager === undefined)
        findings.push(report(MANIFEST, 'package-manager', 'The root package.json names no packageManager.'));
    if (root.workspaces !== undefined && root.private !== true)
        findings.push(
            report(MANIFEST, 'private-root', 'A workspace root is private, so nobody publishes it by accident.'),
        );
    return findings;
}

function installerFindings(input: EngineInput, manifests: Map<string, PackageManifest>): Finding[] {
    const root = manifests.get(MANIFEST);
    const wanted = root?.packageManager;
    const report: Reporter = (file, rule, text) => ({
        check: input.spec.id,
        file,
        line: 1,
        rule,
        message: text,
        fixable: false,
    });
    const differing = manifests
        .entries()
        .filter(([, manifest]) => wanted !== undefined && (manifest.packageManager ?? wanted) !== wanted)
        .toArray();
    return [
        ...rootFindings(report, root),
        ...differing.map(([path, manifest]) =>
            report(
                path,
                'package-manager',
                `This package names ${manifest.packageManager ?? ''}; the root names ${wanted ?? ''}.`,
            ),
        ),
    ];
}

function lockfileFindings(input: EngineInput): Finding[] {
    const kinds = new Map<string, string>();
    for (const file of input.session.repository.files) {
        const kind = LOCKFILES[file.path.slice(file.path.lastIndexOf('/') + 1)];
        if (kind !== undefined && !kinds.has(kind)) kinds.set(kind, file.path);
    }
    if (kinds.size < 2) return [];
    const listed = kinds.values().toArray().join(', ');
    return kinds
        .values()
        .toArray()
        .slice(1)
        .map((path) => ({
            check: input.spec.id,
            file: path,
            line: 1,
            rule: 'foreign-lockfile',
            message: `The repository holds lockfiles of ${String(kinds.size)} package managers: ${listed}. Keep one.`,
            fixable: false,
        }));
}

export const packageManifestSchema = z.object({
    private: z.boolean().optional(),
    packageManager: z.string().optional(),
    workspaces: z.unknown().optional(),
    dependencies: z.record(z.string(), z.string()).optional(),
    devDependencies: z.record(z.string(), z.string()).optional(),
    optionalDependencies: z.record(z.string(), z.string()).optional(),
});

/**
 * The findings of the manifest policy over every tracked package.json.
 * @param input the engine input
 * @returns the findings
 */
export function manifestPolicy(input: EngineInput): Promise<Finding[]> {
    const allowed = (input.view.tool('dependencies')['ranges_allowed'] as { paths: string[] }[] | undefined) ?? [];
    const isRangeAllowed = pathMatcher(allowed.flatMap((entry) => entry.paths));
    const manifests = new Map<string, PackageManifest>();
    for (const file of input.session.repository.files) {
        if (file.nature !== 'source' || !isManifest(file.path)) continue;
        manifests.set(file.path, readManifest(input.root, file.path));
    }
    const ranges = [...manifests].flatMap(([path, manifest]) =>
        isRangeAllowed(path) ? [] : rangeFindings(input, path, manifest),
    );
    return Promise.resolve([...ranges, ...installerFindings(input, manifests), ...lockfileFindings(input)]);
}
