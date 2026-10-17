import { posix } from 'node:path';
import { buildFinding } from '#cli/checks/finding.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { HOOK_FOLDERS } from '#cli/config/repository/hooks.ts';
import { listTaggedExtensions } from '#cli/repository/classify.ts';
import type { Finding, CheckInput } from '#cli/types/checks/run/check.ts';
import { INSTALLED_DEPENDENCY_FOLDERS } from '#cli/config/repository/tracked.ts';
import { SPEC_SUFFIX, INDEX_STEMS } from '#cli/config/checks/general/structure.ts';
import { extractStem, extractExtension, extractParentFolder } from '#cli/system/paths.ts';
import { listCodeFiles, buildFolderTree, isDependencyFolder } from '#cli/checks/general/structure/folder-tree.ts';

// A configuration such as NestJS declares <name>.<kind>.<ext> file names, so these do not count as a shared prefix.
function hasDeclaredKindSuffix(name: string, kinds: Set<string>): boolean {
    const extension = extractExtension(name);
    if (extension.endsWith('x') || !listTaggedExtensions('javascript', 'typescript').includes(extension)) return false;
    const parts = extractStem(name).replace(SPEC_SUFFIX, '').split('.');
    const kind = parts.at(-1);
    return parts.length > 1 && kind !== undefined && kinds.has(kind);
}

/**
 * Extracts the grouping prefix: the stem up to its first dash or dot.
 * @param stem the file name without its extension.
 * @returns the part before the first dash or dot, or all of it.
 */
function extractPrefix(stem: string): string {
    const cuts = [stem.indexOf('-'), stem.indexOf('.')].filter((index) => index >= 0);
    return cuts.length === 0 ? stem : stem.slice(0, Math.min(...cuts));
}

/**
 * Reports each prefix that at least `limits.shared_prefix_files` siblings in a folder share.
 * @param input the scope files and limit.
 * @returns the findings.
 */
export function checkSharedPrefixes(input: CheckInput): Finding[] {
    const limit = input.scope.view.options('limits').shared_prefix_files;
    const prefixes = new Set(input.scope.selected.flatMap((manifest) => manifest.shared_prefixes.prefixes));
    const kinds = new Set(input.scope.selected.flatMap((manifest) => manifest.shared_prefixes.kinds));
    const tree = buildFolderTree(input.files);
    const seen = new Set<string>();

    const files = listCodeFiles(input).filter((file) => {
        const folder = extractParentFolder(file.path);
        return (
            !HOOK_FOLDERS.some((hook) => isInScope(folder, posix.join(input.scope.scope.path, hook))) &&
            !isDependencyFolder(folder)
        );
    });
    return files.flatMap((file) => {
        const folder = extractParentFolder(file.path);
        const stem = extractStem(file.path);
        const prefix = extractPrefix(stem);
        const key = JSON.stringify([folder, prefix]);
        if (prefix === '' || prefixes.has(prefix) || INDEX_STEMS.has(stem) || seen.has(key)) return [];
        const peers = (tree.get(folder) ?? []).filter((entry) => {
            if (entry.kind === 'folder')
                return (
                    !entry.name.startsWith('.') &&
                    !INSTALLED_DEPENDENCY_FOLDERS.has(entry.name) &&
                    extractPrefix(entry.name) === prefix
                );
            if (hasDeclaredKindSuffix(entry.name, kinds)) return false;
            const peerStem = extractStem(entry.name);
            return !INDEX_STEMS.has(peerStem) && extractPrefix(peerStem) === prefix;
        });
        if (
            new Set(peers.map((entry) => (entry.kind === 'folder' ? `${entry.name}/` : extractStem(entry.name)))).size <
            limit
        )
            return [];
        seen.add(key);
        const names = peers.map((entry) => (entry.kind === 'folder' ? `${entry.name}/` : entry.name)).join(', ');
        return [
            buildFinding(
                input,
                { file: file.path, line: 1 },
                'shared-prefix',
                `${names} share the prefix "${prefix}". Group them in a folder named ${prefix} and drop the prefix, or use gspot ignore structure/shared-prefixes with paths and a reason.`,
            ),
        ];
    });
}
