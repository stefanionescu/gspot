import { JSCPD_IGNORED } from '#cli/config/generation/tool-files.ts';
import { JSON_INDENT } from '#cli/config/generation/tool-projects.ts';
import type { ToolFileContext } from '#cli/types/generation/files.ts';
import { buildGlobSections, buildIgnoreSections, buildSettingsSections } from '#cli/generation/ignore-files.ts';

/**
 * Build the jscpd file from the settings.
 * @param context the tool file to build.
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
                ...buildGlobSections([
                    ...buildIgnoreSections(context.session),
                    ...buildSettingsSections(context.selection.view, 'duplication/jscpd'),
                ]),
            ],
        },
        null,
        JSON_INDENT,
    );
}

export { buildJscpdFile };
