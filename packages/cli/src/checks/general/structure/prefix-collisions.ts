import { posix } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { isInScope } from '#cli/repository/paths/public.ts';
import type { BuiltInCheck } from '#cli/types/execution/check.ts';
import { HOOK_DIRECTORIES } from '#cli/config/repository/hooks.ts';
import { DEPENDENCY_FOLDERS } from '#cli/config/repository/inventory.ts';
import { extensionsTagged } from '#cli/repository/discovery/contracts.ts';
import { INDEX_STEMS, NESTJS_KINDS, TOOL_PREFIXES } from '#cli/config/checks/general/structure.ts';
import { structureSources, isDependencyFolder } from '#cli/checks/general/structure/source-files.ts';
import { stemOf, prefixOf, directoryOf, extensionOf, directoryTree } from '#cli/platform/contracts.ts';

// NestJS files share the feature name the folder already carries, so they do not form a set to regroup.
function isNestjsName(name: string): boolean {
    const extension = extensionOf(name);
    // NestJS declaration names apply to script files without JSX.
    if (extension.endsWith('x') || !extensionsTagged('javascript', 'typescript').includes(extension)) return false;
    const parts = name.slice(0, -extension.length).split('.');
    const named = parts.at(-1) === 'spec' ? parts.slice(0, -1) : parts;
    const kind = named.at(-1);
    return named.length > 1 && kind !== undefined && NESTJS_KINDS.has(kind);
}

function isSkipped(directory: string, scope: string): boolean {
    if (HOOK_DIRECTORIES.some((hook) => isInScope(directory, posix.join(scope, hook)))) return true;
    return isDependencyFolder(directory);
}

/**
 * One finding per directory and prefix shared by at least the limit's worth of siblings.
 * @param input the check context
 * @returns the findings
 */
export const prefixCollisions: BuiltInCheck = (input) => {
    const files = structureSources(input);
    const threshold = input.view.limit('prefix_collisions') as number;
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
            isSkipped(directory, input.scope)
        )
            return [];
        const peers = (tree.get(directory) ?? []).filter((entry) => {
            if (entry.kind === 'dir')
                return (
                    !entry.name.startsWith('.') &&
                    !DEPENDENCY_FOLDERS.includes(entry.name) &&
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
                `${names} share the prefix "${prefix}". Group them in a folder named ${prefix} and drop the prefix, or use gspot ignore structure/prefix-collisions with paths and a reason.`,
            ),
        ];
    });
};
