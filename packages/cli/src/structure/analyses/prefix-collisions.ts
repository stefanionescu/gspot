// Sibling entries sharing a name prefix at or above the limit. Searched: ls-lint, eslint-plugin-unicorn; neither compares siblings.
import { pathMatcher } from '#cli/presets/claims.ts';
import type { Analysis, DirectoryEntry } from '#types/structure.ts';
import { HOOK_DIRECTORIES, HOOK_PREFIX, IGNORED_FOLDERS } from '#config/shell.ts';
import { directoryOf, directoryTree, prefixOf, stemOf } from '#cli/structure/directories.ts';

const DEFAULT_THRESHOLD = 2;
const INDEX_STEMS = new Set(['index', 'mod', '__init__']);
// A tool names these files and finds them by that name, so a folder holds several of them by design.
const TOOL_PREFIXES = new Set(['tsconfig', 'jsconfig', 'vitest', 'vite', 'docker', 'eslint', 'playwright']);

function isPeer(entry: DirectoryEntry, prefix: string): boolean {
    if (entry.kind === 'dir')
        return !entry.name.startsWith('.') && !IGNORED_FOLDERS.includes(entry.name) && prefixOf(entry.name) === prefix;
    const peerStem = stemOf(entry.name);
    return !INDEX_STEMS.has(peerStem) && prefixOf(peerStem) === prefix;
}

function isSkipped(directory: string, prefix: string, isAllowed: (path: string) => boolean): boolean {
    if (prefix === HOOK_PREFIX && HOOK_DIRECTORIES.includes(directory)) return true;
    return (
        directory.split('/').some((segment) => IGNORED_FOLDERS.includes(segment)) ||
        isAllowed(directory) ||
        isAllowed(`${directory}/`)
    );
}

/**
 * One finding per directory and prefix shared by at least the limit's worth of siblings.
 * @param context the check context
 * @returns the findings
 */
export const prefixCollisions: Analysis = (context) => {
    const { input } = context;
    const threshold = context.limit('prefix_collisions') ?? DEFAULT_THRESHOLD;
    const isAllowed = pathMatcher(
        input.session.policyFiles.policy.structure.prefix_collision_allowed.flatMap((entry) => entry.paths),
    );
    const tree = directoryTree(input.session.repository.files);
    const seen = new Set<string>();
    const findings = context.files.flatMap((file) => {
        const directory = directoryOf(file.path);
        const stem = stemOf(file.path);
        const prefix = prefixOf(stem);
        const key = `${directory}\n${prefix}`;
        if (
            prefix === '' ||
            TOOL_PREFIXES.has(prefix) ||
            INDEX_STEMS.has(stem) ||
            seen.has(key) ||
            isSkipped(directory, prefix, isAllowed)
        )
            return [];
        const peers = (tree.get(directory) ?? []).filter((entry) => isPeer(entry, prefix));
        if (peers.length < threshold) return [];
        seen.add(key);
        const names = peers.map((entry) => (entry.kind === 'dir' ? `${entry.name}/` : entry.name)).join(', ');
        return [
            context.report(
                file.path,
                1,
                'shared-prefix',
                `${names} share the prefix "${prefix}". Group them in a folder named ${prefix} and drop the prefix, or allow the set with a reason.`,
            ),
        ];
    });
    return Promise.resolve(findings);
};
