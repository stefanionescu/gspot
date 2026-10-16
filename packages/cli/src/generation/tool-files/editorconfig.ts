import type { Settings, ScopeView } from '#cli/types/settings/values.ts';
import { listScopeFormats } from '#cli/generation/tool-files/prettier.ts';
import { escapeGlob, includeFolderContents } from '#cli/repository/matchers.ts';
import type { EditorconfigOverride } from '#cli/types/generation/formatting.ts';
import { UNREPRESENTABLE_SELECTOR, EDITORCONFIG_FIXED_SECTIONS } from '#cli/config/generation/formatting.ts';

// A Prettier selector as an EditorConfig section path, placed under its scope when it has one.
function buildSectionPath(pattern: string, scope: string): string {
    if (pattern.startsWith('!') || UNREPRESENTABLE_SELECTOR.test(pattern))
        throw new Error(
            `EditorConfig cannot represent selector ${JSON.stringify(pattern)}. Keep this override in tools.prettier.extra.value.overrides or an EditorConfig section.`,
        );
    if (scope === '' || pattern.startsWith(`${scope}/`)) return pattern;
    if (!pattern.startsWith('**/') || pattern.slice('**/'.length).includes('/'))
        throw new Error(
            `EditorConfig cannot intersect selector ${JSON.stringify(pattern)} with scope ${scope}. Use a root-relative selector within that scope.`,
        );
    return `${escapeGlob(scope)}/${pattern}`;
}

/**
 * EditorConfig sections for each project's format settings.
 *
 * @param settings the repository settings.
 *
 * @returns one override per selector with the settings EditorConfig can express.
 * @throws when EditorConfig cannot express a selector
 */
export function editorconfigOverrides(settings: Settings): EditorconfigOverride[] {
    return listScopeFormats(settings).flatMap(({ scope, paths, format }) => {
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
    });
}

/**
 * Write the editorconfig configuration from selected settings.
 *
 * @param root0 the values for this generated file.
 * @param root0.format the resolved formatting settings.
 * @param root0.extra the authored additional tool options.
 * @param root0.editorconfigOverrides the authored EditorConfig section reader.
 *
 * @returns the generated configuration text.
 */
export function buildEditorconfigFile({
    format,
    extra,
    editorconfigOverrides,
}: Pick<ScopeView, 'format' | 'extra'> & { editorconfigOverrides: () => EditorconfigOverride[] }): string {
    const native = extra('editorconfig-checker');
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
        { path: '*.md', options: EDITORCONFIG_FIXED_SECTIONS['*.md'] },
        { path: 'Makefile', options: EDITORCONFIG_FIXED_SECTIONS.Makefile },
        ...(native === undefined ? [] : Object.entries(native)).flatMap(([path, options]) =>
            typeof options === 'object' && options !== null ? [{ path, options }] : [],
        ),
        ...editorconfigOverrides(),
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
