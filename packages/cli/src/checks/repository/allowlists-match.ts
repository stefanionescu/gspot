import { basename, dirname } from 'node:path';
import type { Finding } from '#cli/checks/result.ts';
import { pathMatcher } from '#cli/repository/paths.ts';
import type { EngineInput } from '#cli/checks/input.ts';
import { readSource } from '#cli/repository/tracked.ts';
import type { LicenseException } from '#cli/checks/licenses.ts';
import { lockedPackages } from '#cli/repository/locked-packages.ts';
import { normalizedPythonPackage } from '#cli/repository/manifests.ts';

type PathPattern = { pattern: string; where: string };

const POLICY_FILE = 'gspot.toml';

function listed(value: unknown, key: string): string[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry) => {
        const paths = (entry as Record<string, unknown>)[key];
        return Array.isArray(paths) ? paths.map(String) : [];
    });
}

// Tool exclusions list paths; only the docs path exceptions list patterns that are paths (lychee's exclude is URL regexes).
function toolPatterns(tools: Record<string, Record<string, unknown>>): PathPattern[] {
    return Object.entries(tools).flatMap(([tool, table]) =>
        Object.entries(table).flatMap(([setting, value]) => {
            const paths = listed(value, 'paths');
            const patterns = tool === 'docs' && setting === 'paths_allowed' ? listed(value, 'patterns') : [];
            return [...paths, ...patterns].map((pattern) => ({ pattern, where: `tools.${tool}.${setting}` }));
        }),
    );
}

function policyPatterns(input: EngineInput): PathPattern[] {
    const { policy } = input.policyFiles;
    const { structure, naming } = policy;
    const named = (value: unknown, where: string): PathPattern[] =>
        listed(value, 'paths').map((pattern) => ({ pattern, where }));
    return [
        ...policy.ignores.flatMap((entry) => (entry.paths ?? []).map((pattern) => ({ pattern, where: '[[ignore]]' }))),
        ...policy.declarations.flatMap((entry) =>
            entry.paths.map((pattern) => ({ pattern, where: `[[${entry.nature}]]` })),
        ),
        ...named(structure.single_file_folder_allowed, 'structure.single_file_folder_allowed'),
        ...named(structure.prefix_collision_allowed, 'structure.prefix_collision_allowed'),
        ...named(structure.folder_name_allowed, 'structure.folder_name_allowed'),
        ...named(naming.rules, '[[naming.rules]]'),
        ...toolPatterns(policy.tools),
    ];
}

// Every tracked path and every folder above one: an allowance names a folder, an ignore names files.
function matchCandidates(paths: string[]): string[] {
    const folders = new Set<string>();
    for (const path of paths) {
        const parts = path.split('/');
        for (let depth = 1; depth < parts.length; depth += 1) folders.add(parts.slice(0, depth).join('/'));
    }
    return [...paths, ...folders];
}

/**
 * One finding per policy pattern that matches no tracked file or folder. The policy is one per repository, so the root scope reports.
 * @param input the engine input
 * @returns the findings
 */
export function allowlistsMatch(input: EngineInput): Finding[] {
    const candidates = matchCandidates(input.files.map((file) => file.path));
    const findings = policyPatterns(input)
        .filter((entry) => !candidates.some(pathMatcher([entry.pattern])))
        .map((entry) => ({
            check: input.spec.name,
            file: POLICY_FILE,
            line: 1,
            rule: 'unmatched-pattern',
            message: `${entry.pattern} under ${entry.where} matches no tracked file or folder.`,
            fixable: false,
        }));
    const policy = input.policyFiles.policy;
    const locks = new Map<string, Set<string>>();
    for (const [scope, table] of [['', policy], ...Object.entries(policy.scopeTables)] as const) {
        const exceptions = (table.tools?.['licenses']?.['packages_allowed'] ?? []) as LicenseException[];
        if (exceptions.length === 0) continue;
        const paths = input.files.filter(({ path }) => {
            if (path.split('/').includes('.gspot')) return false;
            if (
                ![
                    'package-lock.json',
                    'bun.lock',
                    'pnpm-lock.yaml',
                    'yarn.lock',
                    'uv.lock',
                    'poetry.lock',
                    'pdm.lock',
                ].includes(basename(path))
            )
                return false;
            const folder = dirname(path) === '.' ? '' : dirname(path);
            return scope === '' || path.startsWith(`${scope}/`) || folder === '' || scope.startsWith(`${folder}/`);
        });
        if (paths.length === 0)
            throw new Error('License exceptions require a dependency lockfile in their project or workspace.');
        for (const { path } of paths)
            if (!locks.has(path))
                locks.set(
                    path,
                    lockedPackages(basename(path), readSource(input.root, path, input.observations).toString('utf8')),
                );
        const where = scope === '' ? 'tools.licenses.packages_allowed' : `scope ${scope}`;
        for (const exception of exceptions) {
            const pythonIdentity = exception.package.replace(/^[^@]+(?=@)/u, normalizedPythonPackage);
            if (
                paths.some(({ path }) =>
                    locks
                        .get(path)
                        ?.has(
                            ['uv.lock', 'poetry.lock', 'pdm.lock'].includes(basename(path))
                                ? pythonIdentity
                                : exception.package,
                        ),
                )
            )
                continue;
            findings.push({
                check: input.spec.name,
                file: POLICY_FILE,
                line: 1,
                rule: 'unlocked-package',
                message: `${exception.package} under ${where} is absent from its dependency lockfiles. Remove the exception or correct its exact version.`,
                fixable: false,
            });
        }
    }
    return findings;
}
