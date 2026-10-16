import { JSCPD_IGNORED } from '#cli/config/generation/tool-files.ts';
import { JSON_INDENT } from '#cli/config/generation/tool-projects.ts';
import type { ToolFileContext } from '#cli/types/generation/files.ts';
import { globSections, ignoreSections, settingsSections } from '#cli/generation/ignore-files.ts';
/**
 * Build jscpd file from the selected settings.
 * @param context the repository, scope settings, tool declaration, and output path.
 * @returns the duplication scan settings and source exclusions.
 */
function buildJscpdFile(context: ToolFileContext): string {
    const { settings } = context.selection.view;

    return JSON.stringify(
        {
            mode: 'strict',
            minLines: settings['duplication.min_lines'],
            minTokens: settings['duplication.min_tokens'],
            absolute: true,
            gitignore: true,
            ignore: [
                ...JSCPD_IGNORED,
                ...globSections([
                    ...ignoreSections(context.session),
                    ...settingsSections(context.selection.view, 'duplication/jscpd'),
                ]),
            ],
        },
        null,
        JSON_INDENT,
    );
}

export { buildJscpdFile };
