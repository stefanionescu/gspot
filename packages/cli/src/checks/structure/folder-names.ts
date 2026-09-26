import { pathMatcher } from '#cli/repository/paths.ts';
import { directoryOf } from '#cli/checks/structure/directories.ts';
import type { StructureAnalysis as Analysis } from '#cli/types/checks/structure.ts';
import { BANNED_FOLDER_NAMES, IGNORED_FOLDERS } from '#cli/constants/checks/structure.ts';

/**
 * One finding per banned folder name on the path of a checked file, once per folder.
 * @param context the check context
 * @returns the findings
 */
export const folderNames: Analysis = (context) => {
    const allowed = pathMatcher(
        context.input.policyFiles.policy.structure.folder_name_allowed.flatMap((entry) => entry.paths),
    );
    const seen = new Set<string>();
    return context.files.flatMap((file) => {
        const segments = directoryOf(file.path)
            .split('/')
            .filter((segment) => segment !== '');
        return segments.flatMap((segment, index) => {
            const folder = segments.slice(0, index + 1).join('/');
            if (
                seen.has(folder) ||
                IGNORED_FOLDERS.includes(segment) ||
                !BANNED_FOLDER_NAMES.includes(segment.toLowerCase())
            )
                return [];
            if (allowed(folder) || allowed(`${folder}/`)) return [];
            seen.add(folder);
            return [
                context.report(
                    file.path,
                    1,
                    'container-name',
                    `The folder ${folder}/ is named ${segment}, which says nothing about what it holds.`,
                ),
            ];
        });
    });
};
