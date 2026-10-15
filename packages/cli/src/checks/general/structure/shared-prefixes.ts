import { posix } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { extensionsTagged } from '#cli/repository/tags.ts';
import { HOOK_DIRECTORIES } from '#cli/config/repository/hooks.ts';
import { stemOf, directoryOf, extensionOf } from '#cli/system/paths.ts';
import type { Finding, CheckInput } from '#cli/types/execution/check.ts';
import { INSTALLED_DEPENDENCY_FOLDERS } from '#cli/config/repository/tracked.ts';
import { SPEC_SUFFIX, INDEX_STEMS } from '#cli/config/checks/general/structure.ts';
import { directoryTree, structureSources, isDependencyFolder } from '#cli/checks/general/structure/source-files.ts';

// A selected configuration declares <name>.<kind>.<ext> file names, such as NestJS, so these do not count as a shared prefix.
function hasDeclaredKindSuffix(name: string, kinds: Set<string>): boolean {
    const extension = extensionOf(name);
    // A selected configuration declares <name>.<kind>.<ext> file names, such as NestJS, so these do not count as a shared prefix.
    if (extension.endsWith('x') || !extensionsTagged('javascript', 'typescript').includes(extension)) return false;
    const parts = stemOf(name).replace(SPEC_SUFFIX, '').split('.');
    const kind = parts.at(-1);
    return parts.length > 1 && kind !== undefined && kinds.has(kind);
}

/**
 * A grouping prefix: the stem up to its first dash or dot.
 * @param stem a file stem.
 * @returns the prefix.
 */
function prefixOf(stem: string): string {
    const cuts = [stem.indexOf('-'), stem.indexOf('.')].filter((index) => index >= 0);
    return cuts.length === 0 ? stem : stem.slice(0, Math.min(...cuts));
}

/**
 * One finding per directory and prefix shared by at least the limit's worth of siblings.
 * @param input the check context.
 * @returns the findings.
 */
export function sharedPrefixes(input: CheckInput): Finding[] {
    const limit = input.selection.view.options('limits').prefix_collisions;
    const prefixes = new Set(input.selection.selected.flatMap((manifest) => manifest.prefix_collisions.prefixes));
    const kinds = new Set(input.selection.selected.flatMap((manifest) => manifest.prefix_collisions.kinds));
    const tree = directoryTree(input.files);
    const seen = new Set<string>();
    // eslint-disable-next-line complexity -- reason: Prefix comparison evaluates sibling file and directory relationships together; splitting it adds one-caller predicates.
    return structureSources(input).flatMap((file) => {
        const directory = directoryOf(file.path);
        const stem = stemOf(file.path);
        const prefix = prefixOf(stem);
        const key = JSON.stringify([directory, prefix]);
        if (
            prefix === '' ||
            prefixes.has(prefix) ||
            INDEX_STEMS.has(stem) ||
            seen.has(key) ||
            HOOK_DIRECTORIES.some((hook) => isInScope(directory, posix.join(input.selection.scope.path, hook))) ||
            isDependencyFolder(directory)
        )
            return [];
        const peers = (tree.get(directory) ?? []).filter((entry) => {
            if (entry.kind === 'dir')
                return (
                    !entry.name.startsWith('.') &&
                    !new Set<string | undefined>(INSTALLED_DEPENDENCY_FOLDERS).has(entry.name) &&
                    prefixOf(entry.name) === prefix
                );
            if (hasDeclaredKindSuffix(entry.name, kinds)) return false;
            const peerStem = stemOf(entry.name);
            return !INDEX_STEMS.has(peerStem) && prefixOf(peerStem) === prefix;
        });
        if (new Set(peers.map((entry) => (entry.kind === 'dir' ? `${entry.name}/` : stemOf(entry.name)))).size < limit)
            return [];
        seen.add(key);
        const names = peers.map((entry) => (entry.kind === 'dir' ? `${entry.name}/` : entry.name)).join(', ');
        return [
            findingAt(
                input,
                { file: file.path, line: 1 },
                'shared-prefix',
                `${names} share the prefix "${prefix}". Group them in a folder named ${prefix} and drop the prefix, or use gspot ignore structure/shared-prefixes with paths and a reason.`,
            ),
        ];
    });
}
