import type { ToolFileContext } from '#cli/types/generation/files.ts';
import { listScopeFormats } from '#cli/generation/tool-files/prettier.ts';
import { escapeGlob, includeFolderContents } from '#cli/repository/matchers.ts';
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
 * Build EditorConfig sections from the selected formatting settings.
 * @param context the selected scope and repository formatting settings.
 * @returns the EditorConfig file text.
 */
function buildEditorconfigFile(context: ToolFileContext): string {
    const { format, extra } = context.selection.view;
    const settings = context.session.settingsFile.settings;

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

export { buildEditorconfigFile };
