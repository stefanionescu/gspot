import { findingAt } from '#cli/execution/finding.ts';
import { harnessFolders } from '#cli/policy/settings.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import { directoryOf } from '#cli/checks/general/structure/directories.ts';
import type { StructureAnalysis as Analysis } from '#cli/types/checks/checks.ts';
import { BANNED_FOLDERS, IGNORED_FOLDERS } from '#cli/config/checks/general/structure.ts';

/**
 * One finding per banned folder name on the path of a checked file, once per folder.
 * @param context the check context
 * @returns the findings
 */
export const getDirectories: Analysis = (context) => {
    const allowed = pathMatcher(
        context.input.policyFiles.policy.structure.folder_names_allowed.flatMap((entry) => entry.paths),
    );
    const { input } = context;
    const harnesses = new Set(
        harnessFolders(input.policyFiles.policy, input.scope).map((folder) =>
            [input.scope, folder].filter(Boolean).join('/'),
        ),
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
                harnesses.has(folder) ||
                IGNORED_FOLDERS.includes(segment) ||
                !BANNED_FOLDERS.includes(segment.toLowerCase())
            )
                return [];
            if (allowed(folder) || allowed(`${folder}/`)) return [];
            seen.add(folder);
            return [
                findingAt(
                    context.input,
                    { file: file.path, line: 1 },
                    'container-name',
                    `The folder ${folder}/ is named ${segment}, which says nothing about what it holds.`,
                ),
            ];
        });
    });
};
