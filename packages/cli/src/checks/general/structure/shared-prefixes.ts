import { getTable } from '#cli/settings/scopes.ts';
import type { Session } from '#cli/types/session.ts';
import { buildFinding } from '#cli/checks/finding.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { isInScope, joinScope } from '#cli/repository/scopes.ts';
import { listTaggedExtensions } from '#cli/repository/files/classify.ts';
import { listCodeFiles, buildFolderTree } from '#cli/checks/general/structure/folder-tree.ts';
import { extractBaseName, extractExtension, isInInstalledFolder, extractParentFolder } from '#cli/system/paths.ts';

import {
    SPEC_SUFFIX,
    HOOK_FOLDERS,
    COMPANION_SUFFIX,
    INDEX_BASE_NAMES,
} from '#cli/config/checks/general/structure/shared-prefixes.ts';

function hasKindSuffix(name: string, kinds: Set<string>): boolean {
    const extension = extractExtension(name);
    if (extension.endsWith('x') || !listTaggedExtensions('javascript', 'typescript').includes(extension)) return false;
    const segments = extractBaseName(name).replace(SPEC_SUFFIX, '').split('.');
    const kind = segments.at(-1);
    return segments.length > 1 && kind !== undefined && kinds.has(kind);
}

function extractPrefix(baseName: string): string {
    const cuts = [baseName.indexOf('-'), baseName.indexOf('.')].filter((index) => index >= 0);
    return cuts.length === 0 ? baseName : baseName.slice(0, Math.min(...cuts));
}

/**
Reports each prefix that at least `limits.shared_prefix_files` siblings in a folder share.

@param _session the repository and its tools.
@param planned the scope files and limit.
@returns the findings.
*/
export function checkStructureSharedPrefixes(_session: Session, planned: PlannedCheck): Finding[] {
    const limit = getTable(planned.scope.settings, 'limits').shared_prefix_files;
    const prefixes = new Set(
        planned.scope.configurations.flatMap((configuration) => configuration.shared_prefixes.prefixes),
    );
    const kinds = new Set(planned.scope.configurations.flatMap((configuration) => configuration.shared_prefixes.kinds));
    const tree = buildFolderTree(planned.files);
    const seen = new Set<string>();

    const files = listCodeFiles(planned).filter((file) => {
        const folder = extractParentFolder(file.path);
        return (
            HOOK_FOLDERS.every((hook) => !isInScope(folder, joinScope(planned.scope.path, hook))) &&
            !isInInstalledFolder(folder)
        );
    });
    return files.flatMap((file) => {
        const folder = extractParentFolder(file.path);
        const stem = extractBaseName(file.path);
        const prefix = extractPrefix(stem);
        const key = JSON.stringify([folder, prefix]);
        if (prefix === '' || prefixes.has(prefix) || INDEX_BASE_NAMES.has(stem) || seen.has(key)) return [];
        const peers = (tree.get(folder) ?? []).filter((child) => {
            if (child.kind === 'folder')
                return (
                    !child.name.startsWith('.') &&
                    !isInInstalledFolder(child.name) &&
                    extractPrefix(child.name) === prefix
                );
            if (hasKindSuffix(child.name, kinds)) return false;
            const peerStem = extractBaseName(child.name);
            return !INDEX_BASE_NAMES.has(peerStem) && extractPrefix(peerStem) === prefix;
        });
        if (
            new Set(
                peers.map((peer) =>
                    peer.kind === 'folder' ? `${peer.name}/` : extractBaseName(peer.name).replace(COMPANION_SUFFIX, ''),
                ),
            ).size < limit
        )
            return [];
        seen.add(key);
        const names = peers.map((peer) => (peer.kind === 'folder' ? `${peer.name}/` : peer.name)).join(', ');
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
