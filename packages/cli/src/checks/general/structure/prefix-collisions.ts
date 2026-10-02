// NestJS names a file for its feature and its kind, as its generator writes it: cats.controller.ts beside cats.service.ts.

import { findingAt } from '#cli/execution/finding.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import type { StructureAnalysis as Analysis } from '#cli/types/checks/checks.ts';
import { stemOf, prefixOf, directoryOf, directoryTree } from '#cli/checks/general/structure/directories.ts';

import {
    NEST_KINDS,
    HOOK_PREFIX,
    INDEX_STEMS,
    SCRIPT_ENDING,
    TOOL_PREFIXES,
    IGNORED_FOLDERS,
    DEFAULT_THRESHOLD,
    STRUCTURE_HOOK_DIRECTORIES as HOOK_DIRECTORIES,
} from '#cli/config/checks/general/structure.ts';

// The shared first word is the feature, and the folder already carries it, so these files are no set to regroup.
function isNestName(name: string): boolean {
    if (!SCRIPT_ENDING.test(name)) return false;
    const parts = name.replace(SCRIPT_ENDING, '').split('.');
    const named = parts.at(-1) === 'spec' ? parts.slice(0, -1) : parts;
    const kind = named.at(-1);
    return named.length > 1 && kind !== undefined && NEST_KINDS.has(kind);
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
        input.policyFiles.policy.structure.prefix_collisions_allowed.flatMap((entry) => entry.paths),
    );
    const isNest = input.selection.selected.some((manifest) => manifest.kit.name === 'nestjs');
    const tree = directoryTree(input.files);
    const seen = new Set<string>();
    return context.files.flatMap((file) => {
        const directory = directoryOf(file.path);
        const stem = stemOf(file.path);
        const prefix = prefixOf(stem);
        const key = JSON.stringify([directory, prefix]);
        if (
            prefix === '' ||
            TOOL_PREFIXES.has(prefix) ||
            INDEX_STEMS.has(stem) ||
            seen.has(key) ||
            isSkipped(directory, prefix, isAllowed)
        )
            return [];
        const peers = (tree.get(directory) ?? []).filter((entry) => {
            if (entry.kind === 'dir')
                return (
                    !entry.name.startsWith('.') &&
                    !IGNORED_FOLDERS.includes(entry.name) &&
                    prefixOf(entry.name) === prefix
                );
            if (isNest && isNestName(entry.name)) return false;
            const peerStem = stemOf(entry.name);
            return !INDEX_STEMS.has(peerStem) && prefixOf(peerStem) === prefix;
        });
        if (
            new Set(peers.map((entry) => (entry.kind === 'dir' ? `${entry.name}/` : stemOf(entry.name)))).size <
            threshold
        )
            return [];
        seen.add(key);
        const names = peers.map((entry) => (entry.kind === 'dir' ? `${entry.name}/` : entry.name)).join(', ');
        return [
            findingAt(
                context.input,
                { file: file.path, line: 1 },
                'shared-prefix',
                `${names} share the prefix "${prefix}". Group them in a folder named ${prefix} and drop the prefix, or allow the set with a reason.`,
            ),
        ];
    });
};
