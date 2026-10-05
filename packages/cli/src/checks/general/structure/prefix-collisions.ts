// NestJS names a file for its feature and its kind, as its generator writes it: cats.controller.ts beside cats.service.ts.
import { posix } from 'node:path';
import { findingAt } from '#cli/execution/finding.ts';
import type { Engine } from '#cli/types/execution/runtime.ts';
import { HOOK_DIRECTORIES } from '#cli/config/repository/hooks.ts';
import { isInScope, pathMatcher } from '#cli/repository/selectors.ts';
import { structureSources } from '#cli/checks/general/structure/source-files.ts';
import { stemOf, prefixOf, directoryOf, directoryTree } from '#cli/platform/paths.ts';

import {
    INDEX_STEMS,
    NESTJS_KINDS,
    SCRIPT_ENDING,
    TOOL_PREFIXES,
    IGNORED_FOLDERS,
} from '#cli/config/checks/general/structure.ts';

// The shared first word is the feature, and the folder already carries it, so these files are no set to regroup.
function isNestjsName(name: string): boolean {
    if (!SCRIPT_ENDING.test(name)) return false;
    const parts = name.replace(SCRIPT_ENDING, '').split('.');
    const named = parts.at(-1) === 'spec' ? parts.slice(0, -1) : parts;
    const kind = named.at(-1);
    return named.length > 1 && kind !== undefined && NESTJS_KINDS.has(kind);
}

function isSkipped(directory: string, scope: string, isAllowed: (path: string) => boolean): boolean {
    if (HOOK_DIRECTORIES.some((hook) => isInScope(directory, posix.join(scope, hook)))) return true;
    return (
        directory.split('/').some((segment) => IGNORED_FOLDERS.includes(segment)) ||
        isAllowed(directory) ||
        isAllowed(`${directory}/`)
    );
}

/**
 * One finding per directory and prefix shared by at least the limit's worth of siblings.
 * @param input the check context
 * @returns the findings
 */
export const prefixCollisions: Engine = (input) => {
    const files = structureSources(input);
    const threshold = input.view.limit('prefix_collisions') as number;
    const isAllowed = pathMatcher(
        input.policyFiles.policy.structure.prefix_collisions_allowed.flatMap((entry) => entry.paths),
    );
    const isNest = input.selection.selected.some((manifest) => manifest.configuration.name === 'nestjs');
    const tree = directoryTree(input.files);
    const seen = new Set<string>();
    return files.flatMap((file) => {
        const directory = directoryOf(file.path);
        const stem = stemOf(file.path);
        const prefix = prefixOf(stem);
        const key = JSON.stringify([directory, prefix]);
        if (
            prefix === '' ||
            TOOL_PREFIXES.has(prefix) ||
            INDEX_STEMS.has(stem) ||
            seen.has(key) ||
            isSkipped(directory, input.scope, isAllowed)
        )
            return [];
        const peers = (tree.get(directory) ?? [])
            .filter((entry) => !isAllowed(posix.join(directory, entry.name)))
            .filter((entry) => {
                if (entry.kind === 'dir')
                    return (
                        !entry.name.startsWith('.') &&
                        !IGNORED_FOLDERS.includes(entry.name) &&
                        prefixOf(entry.name) === prefix
                    );
                if (isNest && isNestjsName(entry.name)) return false;
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
                input,
                { file: file.path, line: 1 },
                'shared-prefix',
                `${names} share the prefix "${prefix}". Group them in a folder named ${prefix} and drop the prefix, or allow the set with a reason.`,
            ),
        ];
    });
};
