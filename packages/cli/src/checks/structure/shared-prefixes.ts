import { buildFinding } from '#cli/runs/finding.ts';
import { getTable } from '#cli/settings/scope-view.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { HOOK_FOLDERS } from '#cli/config/repository/hooks.ts';
import { isInScope, joinScope } from '#cli/repository/scopes.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';
import { INSTALLED_DEPENDENCY_FOLDERS } from '#cli/config/repository/tracked.ts';
import { listCodeFiles, buildFolderTree } from '#cli/checks/structure/folder-tree.ts';
import { listTaggedExtensions, isInDependencyFolder } from '#cli/repository/classify.ts';
import { extractStem, extractExtension, extractParentFolder } from '#cli/system/paths.ts';
import { SPEC_SUFFIX, INDEX_STEMS, COMPANION_SUFFIX } from '#cli/config/checks/structure.ts';

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
 *
 * @param stem the file name without its extension.
 * @returns the part before the first dash or dot, or all of it.
 */
function extractPrefix(stem: string): string {
    const cuts = [stem.indexOf('-'), stem.indexOf('.')].filter((index) => index >= 0);
    return cuts.length === 0 ? stem : stem.slice(0, Math.min(...cuts));
}

/**
 * Reports each prefix that at least `limits.shared_prefix_files` siblings in a folder share.
 *
 * @param _session the repository and its tools.
 * @param planned the scope files and limit.
 * @returns the findings.
 */
export function checkSharedPrefixes(_session: Session, planned: PlannedCheck): Finding[] {
    const limit = getTable(planned.selection.view, 'limits').shared_prefix_files;
    const prefixes = new Set(planned.selection.selected.flatMap((manifest) => manifest.shared_prefixes.prefixes));
    const kinds = new Set(planned.selection.selected.flatMap((manifest) => manifest.shared_prefixes.kinds));
    const tree = buildFolderTree(planned.files);
    const seen = new Set<string>();

    const files = listCodeFiles(planned).filter((file) => {
        const folder = extractParentFolder(file.path);
        return (
            !HOOK_FOLDERS.some((hook) => isInScope(folder, joinScope(planned.selection.scope.path, hook))) &&
            !isInDependencyFolder(folder)
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
        // A file and its companions, such as button.tsx, button.module.css, and button.test.tsx, count as one name.
        if (
            new Set(
                peers.map((entry) =>
                    entry.kind === 'folder' ? `${entry.name}/` : extractStem(entry.name).replace(COMPANION_SUFFIX, ''),
                ),
            ).size < limit
        )
            return [];
        seen.add(key);
        const names = peers.map((entry) => (entry.kind === 'folder' ? `${entry.name}/` : entry.name)).join(', ');
        return [
            buildFinding(
                planned,
                { file: file.path, line: 1 },
                'shared-prefix',
                `${names} share the prefix "${prefix}". Group them in a folder named ${prefix} and drop the prefix, or use gspot ignore structure/shared-prefixes with paths and a reason.`,
            ),
        ];
    });
}
