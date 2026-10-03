import { dirname, basename } from 'node:path';
import { findingAt } from '#cli/execution/finding.ts';
import { readSource } from '#cli/repository/sources.ts';
import { DOT_GSPOT } from '#cli/config/repository/repository.ts';
import { lockedPackages } from '#cli/repository/locked-packages.ts';
import { pathTokens, proseLines } from '#cli/parsers/references.ts';
import { POLICY_FILE } from '#cli/config/checks/general/structure.ts';
import { isInScope, pathMatcher } from '#cli/repository/selectors.ts';
import { normalizedPythonPackage } from '#cli/repository/packages.ts';
import type { PathPattern } from '#cli/types/checks/general/structure.ts';
import type { LicenseException } from '#cli/types/checks/general/general.ts';
import type { Finding, EngineInput } from '#cli/types/execution/execution.ts';

function listed(value: unknown, key: string): string[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry) => {
        const paths = (entry as Record<string, unknown>)[key];
        return Array.isArray(paths) ? paths.map(String) : [];
    });
}

// Tool exclusions list their paths under paths; the URL patterns of tools.lychee.exclude_urls are no paths.
function toolPatterns(tools: Record<string, Record<string, unknown>>): PathPattern[] {
    return Object.entries(tools).flatMap(([tool, table]) =>
        Object.entries(table).flatMap(([setting, value]) =>
            listed(value, 'paths').map((pattern) => ({ pattern, where: `tools.${tool}.${setting}` })),
        ),
    );
}

function policyPatterns(input: EngineInput): PathPattern[] {
    const { policy } = input.policyFiles;
    const { structure, naming } = policy;
    return [
        ...policy.ignores.flatMap((entry) => (entry.paths ?? []).map((pattern) => ({ pattern, where: '[[ignore]]' }))),
        ...policy.declarations.flatMap((entry) =>
            entry.paths.map((pattern) => ({ pattern, where: `[[${entry.kind}]]` })),
        ),
        ...listed(structure.lone_files_allowed, 'paths').map((pattern) => ({
            pattern,
            where: 'structure.lone_files_allowed',
        })),
        ...listed(structure.prefix_collisions_allowed, 'paths').map((pattern) => ({
            pattern,
            where: 'structure.prefix_collisions_allowed',
        })),
        ...listed(structure.folder_names_allowed, 'paths').map((pattern) => ({
            pattern,
            where: 'structure.folder_names_allowed',
        })),
        ...listed(naming.rules, 'paths').map((pattern) => ({ pattern, where: '[[naming.rules]]' })),
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

// The path tokens of tracked Markdown prose, which can justify an exception for an untracked output or external path.
function referencedPaths(input: EngineInput): Set<string> {
    const referenced = new Set<string>();
    const files = input.files.filter((file) => file.kind === 'source' && file.path.endsWith('.md'));
    for (const file of files) {
        const prose = proseLines(readSource(input.root, file.path, input.reads).toString('utf8'));
        for (const { line } of prose)
            for (const token of pathTokens(line)) referenced.add(token.replace(/^\.\//u, '').replace(/\/$/u, ''));
    }
    return referenced;
}

function licenseFindings(input: EngineInput): Finding[] {
    const policy = input.policyFiles.policy;
    const locks = new Map<string, Set<string>>();
    const tables = [['', policy], ...Object.entries(policy.scopeTables)] as const;
    return tables.flatMap(([scope, table]) => {
        const exceptions = (table.tools?.['licenses']?.['exceptions'] ?? []) as LicenseException[];
        if (exceptions.length === 0) return [];
        const paths = input.files.filter(({ path }) => {
            if (path.split('/').includes(DOT_GSPOT)) return false;
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
            return isInScope(path, scope) || isInScope(scope, folder);
        });
        if (paths.length === 0)
            throw new Error('License exceptions require a dependency lockfile in their project or workspace.');
        const packages = paths.map(({ path }) => {
            let names = locks.get(path);
            if (names === undefined) {
                names = lockedPackages(basename(path), readSource(input.root, path, input.reads).toString('utf8'));
                locks.set(path, names);
            }
            return { names, python: ['uv.lock', 'poetry.lock', 'pdm.lock'].includes(basename(path)) };
        });
        const where = scope === '' ? 'tools.licenses.exceptions' : `scope ${scope}`;
        return exceptions.flatMap((exception): Finding[] => {
            const pythonIdentity = exception.package.replace(/^[^@]+(?=@)/u, normalizedPythonPackage);
            if (packages.some(({ names, python }) => names.has(python ? pythonIdentity : exception.package))) return [];
            return [
                findingAt(
                    input,
                    { file: POLICY_FILE, line: 1 },
                    'unlocked-package',
                    `${exception.package} under ${where} is absent from its dependency lockfiles. Remove the exception or correct its exact version.`,
                ),
            ];
        });
    });
}

/**
 * One finding per policy pattern that matches no tracked file or folder. The policy is one per repository, so the root scope reports.
 * @param input the engine input
 * @returns the findings
 */
export function staleAllowlists(input: EngineInput): Finding[] {
    const candidates = matchCandidates(input.files.map((file) => file.path));
    const references = referencedPaths(input);
    const findings = policyPatterns(input)
        .filter((entry) => {
            const matches = pathMatcher([entry.pattern]);
            if (candidates.some((path) => matches(path))) return false;
            return entry.where !== 'tools.docs.exclude' || ![...references].some((path) => matches(path));
        })
        .map((entry) =>
            findingAt(
                input,
                { file: POLICY_FILE, line: 1 },
                'unmatched-pattern',
                `${entry.pattern} under ${entry.where} matches no tracked file or folder.`,
            ),
        );
    return [...findings, ...licenseFindings(input)];
}
