import { GspotError } from '#cli/system/errors.ts';
import { DOT_GSPOT } from '#cli/config/gspot-paths.ts';
import { BACKSLASH_BEFORE_MATCH } from '#cli/config/text.ts';
import { AGENTS_FILE } from '#cli/config/generation/rules.ts';
import { GLOB_SPECIAL_CHARACTERS } from '#cli/config/system/paths.ts';
import type { PlannedToolFile } from '#cli/types/generation/files.ts';
import { listScopeFormats } from '#cli/generation/settings/builders/prettier.ts';
import { buildPathMatcher, includeFolderContents } from '#cli/repository/matchers.ts';

import {
    UNREPRESENTABLE_SELECTOR,
    EDITORCONFIG_FIXED_SECTIONS,
} from '#cli/config/generation/settings/builders/editorconfig.ts';

// Convert a Prettier selector to an EditorConfig section path, under its scope when it has one.
function buildSectionPath(pattern: string, scope: string): string {
    if (pattern.startsWith('!') || UNREPRESENTABLE_SELECTOR.test(pattern))
        throw new GspotError(
            'settings',
            `EditorConfig cannot represent selector ${JSON.stringify(pattern)}. Keep this override in a \`[[format.override]]\` record with a selector that EditorConfig can read.`,
        );
    if (scope === '' || pattern.startsWith(`${scope}/`)) return pattern;
    if (!pattern.startsWith('**/') || pattern.slice('**/'.length).includes('/'))
        throw new GspotError(
            'settings',
            `EditorConfig cannot intersect selector ${JSON.stringify(pattern)} with scope ${scope}. Use a root-relative selector within that scope.`,
        );
    return `${scope.replaceAll(GLOB_SPECIAL_CHARACTERS, BACKSLASH_BEFORE_MATCH)}/${pattern}`;
}

/**
 * Build the EditorConfig file from the settings.
 *
 * @param planned the tool file to build.
 * @returns the EditorConfig sections of this repository.
 */
export function buildEditorconfigFile(planned: PlannedToolFile): string {
    const { format } = planned.selection.view.values;
    const settings = planned.session.settingsFile.settings;
    const paths = [
        ...planned.session.repository.files
            .filter(
                (file) =>
                    !file.path.startsWith(`${DOT_GSPOT}/`) &&
                    (file.kind !== 'generated' || file.kindOrigin !== 'gspot'),
            )
            .map((file) => file.path),
        ...(settings.rules.enabled ? [AGENTS_FILE] : []),
    ];

    const sections = [
        {
            path: '*',
            options: {
                ...EDITORCONFIG_FIXED_SECTIONS['*'],
                end_of_line: format.line_ending,
                insert_final_newline: format.final_newline,
                indent_style: format.indent_style,
                indent_size: format.indent_width,
            },
        },
        ...Object.entries(EDITORCONFIG_FIXED_SECTIONS)
            .filter(([path]) => path !== '*' && paths.some(buildPathMatcher([path])))
            .map(([path, options]) => ({ path, options })),
        ...listScopeFormats(settings).flatMap(({ scope, paths, format }) => {
            const options = {
                ...(format.indent_style === undefined ? {} : { indent_style: format.indent_style }),
                ...(format.indent_width === undefined ? {} : { indent_size: format.indent_width }),
                ...(format.line_ending === undefined ? {} : { end_of_line: format.line_ending }),
                ...(format.final_newline === undefined ? {} : { insert_final_newline: format.final_newline }),
            };
            if (Object.keys(options).length === 0) return [];
            return includeFolderContents(paths).map((pattern) => ({
                path: `/${buildSectionPath(pattern, scope)}`,
                options,
            }));
        }),
    ];
    return (
        'root = true\n\n' +
        sections
            .map(
                ({ path, options }) =>
                    `[${path}]\n` +
                    Object.entries(options)
                        .map(([key, value]) => `${key} = ${String(value)}`)
                        .join('\n'),
            )
            .join('\n\n') +
        '\n'
    );
}
