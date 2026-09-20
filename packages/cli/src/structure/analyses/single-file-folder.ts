import type { Analysis } from '#types/structure.ts';
// A leaf folder holding one code file. Searched: eslint-plugin-unicorn, ls-lint, knip; none sees a folder.
import { pathMatcher } from '#cli/presets/claims.ts';
import { IGNORED_FOLDERS } from '#config/structure.ts';
import { languagePresets } from '#cli/presets/select.ts';
import { directoryOf, directoryTree } from '#cli/structure/directories.ts';

function isSkipped(directory: string, isAllowed: (path: string) => boolean): boolean {
    if (directory === '' || directory.split('/').some((segment) => IGNORED_FOLDERS.includes(segment))) return true;
    return isAllowed(directory) || isAllowed(`${directory}/`);
}

/**
 * One finding per leaf folder that holds exactly one code file and nothing else.
 * @param context the check context
 * @returns the findings
 */
export const singleFileFolder: Analysis = (context) => {
    const { input } = context;
    const selection = input.session.scopes.find((entry) => entry.scope.path === input.scope);
    const extensions = languagePresets(selection?.selected ?? []).flatMap((manifest) => manifest.claims.extensions);
    const isAllowed = pathMatcher(
        input.session.policyFiles.policy.structure.single_file_folder_allowed.flatMap((entry) => entry.paths),
    );
    const tree = directoryTree(input.session.repository.files);
    const checked = new Set(context.files.map((file) => directoryOf(file.path)));
    const findings = [...checked].flatMap((directory) => {
        if (isSkipped(directory, isAllowed)) return [];
        const entries = tree.get(directory) ?? [];
        if (entries.some((entry) => entry.kind === 'dir')) return [];
        const code = entries.filter(
            (entry) => !entry.name.endsWith('.d.ts') && extensions.some((extension) => entry.name.endsWith(extension)),
        );
        const [only] = code;
        if (only === undefined || code.length !== 1) return [];
        return [
            context.report(
                `${directory}/${only.name}`,
                1,
                'lone-file',
                `The folder ${directory}/ holds only ${only.name}.`,
            ),
        ];
    });
    return Promise.resolve(findings);
};
