import { directoryOf } from '#cli/platform/paths.ts';
import { findingAt } from '#cli/execution/finding.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import type { Engine } from '#cli/types/execution/runtime.ts';
import { repositoryHarnessFolders } from '#cli/policy/settings/entries.ts';
import { structureSources } from '#cli/checks/general/structure/source-files.ts';
import { BANNED_FOLDERS, IGNORED_FOLDERS } from '#cli/config/checks/general/structure.ts';

/**
 * One finding per banned folder name on the path of a checked file, once per folder.
 * @param input the check context
 * @returns the findings
 */
export const getDirectories: Engine = (input) => {
    const files = structureSources(input);
    const allowed = pathMatcher(
        input.policyFiles.policy.structure.folder_names_allowed.flatMap((entry) => entry.paths),
    );
    const harnesses = new Set(repositoryHarnessFolders(input.policyFiles.policy, input.scope));
    const seen = new Set<string>();
    return files.flatMap((file) => {
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
                    input,
                    { file: file.path, line: 1 },
                    'container-name',
                    `The folder ${folder}/ is named ${segment}, which says nothing about what it holds.`,
                ),
            ];
        });
    });
};
