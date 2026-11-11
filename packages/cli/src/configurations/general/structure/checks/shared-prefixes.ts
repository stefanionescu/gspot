import { posix } from 'node:path';

import {
    COMPANION_SUFFIX,
    GSPOT_FIXED_NAMES,
    HOOK_FOLDERS,
    INDEX_BASE_NAMES,
    SHARED_PREFIX_RULE,
    SPEC_SUFFIX,
    TYPE_FILE_CASE,
} from '#cli/config/configurations/structure.ts';
import { readNamingSettings } from '#cli/configurations/general/naming/checks/settings.ts';
import { listNamedFiles } from '#cli/configurations/general/naming/checks/source-names.ts';
import { buildFolderTree, listCodeFiles } from '#cli/configurations/general/structure/checks/folder-tree.ts';
import { listTaggedExtensions } from '#cli/repository/files/classify.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { getTable } from '#cli/settings/scopes.ts';
import {
    extractBaseName,
    extractExtension,
    extractParentFolder,
    isInInstalledFolder,
    isInScope,
} from '#cli/system/paths.ts';
import { splitWords } from '#cli/system/text.ts';
import type { FolderChild } from '#cli/types/configurations/general.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode, CheckFinding } from '#cli/types/engine/run.ts';
import type { Session } from '#cli/types/tools.ts';

function hasKindSuffix(name: string, kinds: Set<string>): boolean {
    const extension = extractExtension(name);
    const isComponentFile = extension.endsWith('x');
    if (isComponentFile || !listTaggedExtensions('javascript', 'typescript').includes(extension)) return false;
    const segments = extractBaseName(name).replace(SPEC_SUFFIX, '').split('.');
    const kind = segments.at(-1);
    return segments.length > 1 && kind !== undefined && kinds.has(kind);
}

function buildPrefixGroups(
    children: FolderChild[],
    isGrouped: (child: FolderChild) => boolean,
): Map<string, FolderChild[]> {
    const grouped = children.filter((child) => isGrouped(child));
    return Map.groupBy(grouped, (child) => {
        const name = child.kind === 'folder' ? child.name : extractBaseName(child.name);
        return splitWords(name)[0] ?? '';
    });
}

function listTypeNamedFiles(session: Session, planned: PlannedCheck): Set<string> {
    const { limitLookup } = readNamingSettings(session.settings, planned.scope);
    return new Set(
        listNamedFiles(planned)
            .filter(({ language }) =>
                limitLookup(language, 'files').cases.some((name) => name.startsWith(TYPE_FILE_CASE)),
            )
            .map(({ file }) => file.path),
    );
}

/**
Reports each prefix that at least `limits.min_shared_prefix_files` siblings in a folder share. gspot fixes the name of
gspot.toml, so it shares no prefix.
*/
function checkSharedPrefixes(session: Session, planned: PlannedCheck): CheckFinding[] {
    const limit = getTable(planned.scope.settings, 'limits').min_shared_prefix_files;
    const prefixes = new Set(
        planned.scope.configurations.flatMap((configuration) => configuration.shared_prefixes.prefixes),
    );
    const kinds = new Set(planned.scope.configurations.flatMap((configuration) => configuration.shared_prefixes.kinds));
    const tree = buildFolderTree(planned.files.filter(({ path }) => !GSPOT_FIXED_NAMES.has(path)));
    const typeNamed = listTypeNamedFiles(session, planned);
    const codeFiles = new Set(
        listCodeFiles(planned)
            .map((file) => file.path)
            .filter((path) => {
                const folder = extractParentFolder(path);
                return (
                    HOOK_FOLDERS.every((hook) => !isInScope(folder, joinScope(planned.scope.path, hook))) &&
                    !isInInstalledFolder(folder)
                );
            }),
    );
    const folders = new Set(codeFiles.values().map((path) => extractParentFolder(path)));
    return [...folders].flatMap((folder) => {
        const groups = buildPrefixGroups(tree.get(folder) ?? [], (child) =>
            child.kind === 'folder'
                ? !child.name.startsWith('.') && !isInInstalledFolder(child.name)
                : !hasKindSuffix(child.name, kinds) &&
                  !INDEX_BASE_NAMES.has(extractBaseName(child.name)) &&
                  !typeNamed.has(joinScope(folder, child.name)),
        );
        return [...groups].flatMap(([prefix, peers]) => {
            const first = peers.find((peer) => codeFiles.has(joinScope(folder, peer.name)));
            if (
                first === undefined ||
                prefix === '' ||
                prefixes.has(prefix) ||
                posix.basename(folder).toLowerCase() === prefix
            )
                return [];
            const stems = new Set(
                peers.map((peer) =>
                    peer.kind === 'folder' ? `${peer.name}/` : extractBaseName(peer.name).replace(COMPANION_SUFFIX, ''),
                ),
            );
            if (stems.size < limit) return [];
            const names = peers.map((peer) => (peer.kind === 'folder' ? `${peer.name}/` : peer.name)).join(', ');
            return [
                {
                    file: joinScope(folder, first.name),
                    line: 1,
                    rule: SHARED_PREFIX_RULE,
                    message: `${names} share the prefix "${prefix}". Group them in a folder named ${prefix} and drop the prefix, or use gspot ignore structure/shared-prefixes with paths and a reason.`,
                },
            ];
        });
    });
}

export const STRUCTURE_SHARED_PREFIXES_CHECKS: Readonly<Record<string, CheckCode>> = {
    'structure/shared-prefixes': { check: checkSharedPrefixes },
};
