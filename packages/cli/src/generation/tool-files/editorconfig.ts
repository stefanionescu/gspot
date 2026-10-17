import { isInGspotFolder } from '#cli/repository/classify.ts';
import { AGENTS_FILE, CLAUDE_FILE } from '#cli/config/rules.ts';
import type { ToolFileContext } from '#cli/types/generation/files.ts';
import { listScopeFormats } from '#cli/generation/tool-files/prettier.ts';
import { escapeGlob, buildPathMatcher, includeFolderContents } from '#cli/repository/matchers.ts';
import { UNREPRESENTABLE_SELECTOR, EDITORCONFIG_FIXED_SECTIONS } from '#cli/config/generation/formatting.ts';

// Convert a Prettier selector to an EditorConfig section path, under its scope when it has one.
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
 * Build the EditorConfig file from the settings.
 * @param context the tool file to build.
 * @returns the EditorConfig sections of this repository.
 */
function buildEditorconfigFile(context: ToolFileContext): string {
    const { format, extra } = context.selection.view;
    const settings = context.session.settingsFile.settings;
    const paths = [
        ...context.session.repository.files
            .filter((file) => !isInGspotFolder(file.path) && (file.kind !== 'generated' || file.kindOrigin !== 'gspot'))
            .map((file) => file.path),
        ...(settings.rules.enabled ? [AGENTS_FILE, CLAUDE_FILE] : []),
    ];

    const extraOptions = extra('editorconfig-checker');
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
        ...(extraOptions === undefined ? [] : Object.entries(extraOptions)).flatMap(([path, options]) =>
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
