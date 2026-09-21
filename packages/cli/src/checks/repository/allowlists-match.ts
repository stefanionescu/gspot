// Every path pattern in the policy matches at least one tracked file or folder: an ignore, a declaration, an allowance or an exclusion that matches nothing is a leftover.
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { pathMatcher } from '#cli/presets/claims.ts';
import type { PathPattern } from '#types/integrity.ts';

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
    const { policy } = input.session.policyFiles;
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
export function allowlistsMatch(input: EngineInput): Promise<Finding[]> {
    const candidates = matchCandidates(input.session.repository.files.map((file) => file.path));
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
    return Promise.resolve(findings);
}
