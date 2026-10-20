import { JSON_INDENT } from '#cli/config/generation/files.ts';
import { listIgnoredGlobs } from '#cli/generation/ignore-files.ts';
import { JSCPD_IGNORED } from '#cli/config/generation/tool-files.ts';
import type { ToolFileContext } from '#cli/types/generation/files.ts';

/**
 * Build the jscpd file from the settings.
 *
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
                ...listIgnoredGlobs(context.session, context.selection.view, 'duplication/jscpd'),
            ],
        },
        null,
        JSON_INDENT,
    );
}

export { buildJscpdFile };
