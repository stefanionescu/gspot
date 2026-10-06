import { basename } from 'node:path';
import { isRecord } from '#cli/platform/objects.ts';
import { readSource } from '#cli/platform/source.ts';
import { findingAt } from '#cli/execution/finding.ts';
import { lockedPackages } from '#cli/parsers/lockfiles.ts';
import { everyTable } from '#cli/policy/settings/entries.ts';
import { directoryOf, expandPaths } from '#cli/platform/paths.ts';
import { normalizedPythonIdentity } from '#cli/parsers/packages.ts';
import { isInScope, pathMatcher } from '#cli/repository/selectors.ts';
import type { PathPattern } from '#cli/types/checks/general/structure.ts';
import { DOT_GSPOT, POLICY_FILE } from '#cli/config/platform/locations.ts';
import type { Finding, EngineInput } from '#cli/types/execution/runtime.ts';
import type { LicenseException } from '#cli/types/checks/general/licenses.ts';
import { pathTokens, proseLines, cleanPathToken } from '#cli/parsers/markdown.ts';

function listedPaths(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry) => {
        if (!isRecord(entry)) return [];
        const paths = entry['paths'];
        return Array.isArray(paths) ? paths.map(String) : [];
    });
}

// Only paths keys are read, so URL patterns such as tools.lychee.exclude_urls are skipped.
function settingPatterns(tools: Record<string, Record<string, unknown>>, prefix: string): PathPattern[] {
    return Object.entries(tools).flatMap(([tool, table]) =>
        Object.entries(table).flatMap(([setting, value]) =>
            listedPaths(value).map((pattern) => ({ pattern, where: `${prefix}${tool}.${setting}` })),
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
        ...listedPaths(structure.lone_files_allowed).map((pattern) => ({
            pattern,
            where: 'structure.lone_files_allowed',
        })),
        ...listedPaths(structure.prefix_collisions_allowed).map((pattern) => ({
            pattern,
            where: 'structure.prefix_collisions_allowed',
        })),
        ...listedPaths(structure.folder_names_allowed).map((pattern) => ({
            pattern,
            where: 'structure.folder_names_allowed',
        })),
        ...listedPaths(naming.paths).map((pattern) => ({ pattern, where: '[[naming.paths]]' })),
        ...settingPatterns(policy.tools, 'tools.'),
        ...(policy.configurationSettings === undefined ? [] : settingPatterns(policy.configurationSettings, '')),
    ];
}

// The path tokens of tracked Markdown prose, which can justify an exception for an untracked output or external path.
function referencedPaths(input: EngineInput): Set<string> {
    const referenced = new Set<string>();
    const files = input.files.filter((file) => file.kind === 'source' && file.path.endsWith('.md'));
    for (const file of files) {
        const prose = proseLines(readSource(input.root, file.path, input.reads).toString('utf8'));
        for (const { line } of prose) for (const token of pathTokens(line)) referenced.add(cleanPathToken(token));
    }
    return referenced;
}

function licenseFindings(input: EngineInput): Finding[] {
    const policy = input.policyFiles.policy;
    const locks = new Map<string, Set<string>>();
    return everyTable(policy).flatMap(({ scope = '', table }) => {
        const exceptions = (table.configurationSettings?.['licenses']?.['exceptions'] ?? []) as LicenseException[];
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
            const folder = directoryOf(path);
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
        const where = scope === '' ? 'licenses.exceptions' : `scope ${scope}`;
        return exceptions.flatMap((exception): Finding[] => {
            const pythonIdentity = normalizedPythonIdentity(exception.package);
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
    const candidates = [...expandPaths(input.files.map((file) => file.path))];
    const references = referencedPaths(input);
    const findings = policyPatterns(input)
        .filter((entry) => {
            const matches = pathMatcher([entry.pattern]);
            if (candidates.some((path) => matches(path))) return false;
            return entry.where !== 'docs.exclude' || ![...references].some((path) => matches(path));
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
