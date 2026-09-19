// Sibling entries sharing a name prefix at or above the limit. Searched: ls-lint, eslint-plugin-unicorn; neither compares siblings.
import { pathMatcher } from '#cli/presets/claims.ts';
import type { Analysis, DirectoryEntry } from '#types/structure.ts';
import { HOOK_DIRECTORIES, HOOK_PREFIX, IGNORED_FOLDERS } from '#config/shell.ts';
import { directoryOf, directoryTree, prefixOf, stemOf } from '#cli/structure/directories.ts';

const DEFAULT_THRESHOLD = 2;
const NEST_KINDS = new Set([
    'controller',
    'service',
    'module',
    'guard',
    'pipe',
    'filter',
    'interceptor',
    'middleware',
    'decorator',
    'gateway',
    'resolver',
    'repository',
    'entity',
    'dto',
    'strategy',
    'provider',
]);
const SCRIPT_ENDING = /\.[cm]?[jt]s$/u;
const INDEX_STEMS = new Set(['index', 'mod', '__init__']);
// A tool names these files and finds them by that name, so a folder holds several of them by design.
const TOOL_PREFIXES = new Set(['tsconfig', 'jsconfig', 'vitest', 'vite', 'docker', 'eslint', 'playwright']);

function isPeer(entry: DirectoryEntry, prefix: string, isNamedByFramework: (name: string) => boolean): boolean {
    if (entry.kind === 'file' && isNamedByFramework(entry.name)) return false;
    if (entry.kind === 'dir')
        return !entry.name.startsWith('.') && !IGNORED_FOLDERS.includes(entry.name) && prefixOf(entry.name) === prefix;
    const peerStem = stemOf(entry.name);
    return !INDEX_STEMS.has(peerStem) && prefixOf(peerStem) === prefix;
}

// NestJS names a file for its feature and its kind, as its generator writes it: cats.controller.ts beside cats.service.ts.
// The shared first word is the feature, and the folder already carries it, so these files are no set to regroup.
function isNestName(name: string): boolean {
    if (!SCRIPT_ENDING.test(name)) return false;
    const parts = name.replace(SCRIPT_ENDING, '').split('.');
    const named = parts.at(-1) === 'spec' ? parts.slice(0, -1) : parts;
    return named.length > 1 && NEST_KINDS.has(named.at(-1) ?? '');
}

function isNeverNamed(): boolean {
    return false;
}

function frameworkNames(selected: string[]): (name: string) => boolean {
    return selected.includes('nestjs') ? isNestName : isNeverNamed;
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
    const selected = input.session.scopes.find((entry) => entry.scope.path === input.scope)?.selected ?? [];
    const isNamedByFramework = frameworkNames(selected.map((manifest) => manifest.preset.id));
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
        const peers = (tree.get(directory) ?? []).filter((entry) => isPeer(entry, prefix, isNamedByFramework));
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
