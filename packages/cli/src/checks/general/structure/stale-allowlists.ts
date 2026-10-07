import { findingAt } from '#cli/checks/finding.ts';
import { isRecord } from '#cli/platform/objects.ts';
import { expandPaths } from '#cli/platform/paths.ts';
import { readSource } from '#cli/platform/source.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { POLICY_FILE } from '#cli/config/platform/locations.ts';
import type { PathPattern } from '#cli/types/checks/general/structure.ts';
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

function policyPatterns(input: CheckInput): PathPattern[] {
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
function referencedPaths(input: CheckInput): Set<string> {
    const referenced = new Set<string>();
    const files = input.files.filter((file) => file.kind === 'source' && file.path.endsWith('.md'));
    for (const file of files) {
        const prose = proseLines(readSource(input.root, file.path, input.reads).toString('utf8'));
        for (const { line } of prose) for (const token of pathTokens(line)) referenced.add(cleanPathToken(token));
    }
    return referenced;
}

/**
 * One finding per policy pattern that matches no tracked file or folder. The policy is one per repository, so the root scope reports.
 * @param input the check input
 * @returns the findings
 */
export function staleAllowlists(input: CheckInput): Finding[] {
    const candidates = [...expandPaths(input.files.map((file) => file.path))];
    const references = referencedPaths(input);
    return policyPatterns(input)
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
}
