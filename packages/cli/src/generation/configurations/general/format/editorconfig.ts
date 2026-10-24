import { escapeGlob } from '#cli/system/paths.ts';
import { GspotError } from '#cli/system/errors.ts';
import type { PlannedConfigFile } from '#cli/types/generation/files.ts';
import { includeFolderContents } from '#cli/repository/files/matchers.ts';
import { listScopeFormats } from '#cli/generation/configurations/general/format/prettier.ts';

import {
    UNREPRESENTABLE_SELECTOR,
    EDITORCONFIG_FIXED_SECTIONS,
} from '#cli/config/generation/configurations/general/format/editorconfig.ts';

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
    return `${escapeGlob(scope)}/${pattern}`;
}

/**
Build .editorconfig: the EditorConfig sections of this repository.

@param planned the config file with its scope, level, and target path.
@returns the EditorConfig sections of this repository.
*/
export function buildEditorconfigFile(planned: PlannedConfigFile): string {
    const { format } = planned.scope.settings.values;
    const settings = planned.session.settingsFile.settings;

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
            .filter(([path]) => path !== '*')
            .map(([path, options]) => ({ path, options })),
        ...listScopeFormats(settings).flatMap(({ scope, paths, format }) => {
            const options = {
                ...(format.indent_style !== undefined && { indent_style: format.indent_style }),
                ...(format.indent_width !== undefined && { indent_size: format.indent_width }),
                ...(format.line_ending !== undefined && { end_of_line: format.line_ending }),
                ...(format.final_newline !== undefined && { insert_final_newline: format.final_newline }),
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
