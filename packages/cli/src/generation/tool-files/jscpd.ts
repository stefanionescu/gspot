import { JSON_INDENT } from '#cli/config/generation/tool-projects.ts';
import type { ToolFileContext } from '#cli/types/generation/files.ts';
import { JSCPD_IGNORED } from '#cli/config/generation/tool-file-sources.ts';
/**
 * Build jscpd file from the selected settings.
 * @param context the repository, scope settings, tool declaration, and output path.
 * @returns the duplication scan settings and source exclusions.
 */
function buildJscpdFile(context: ToolFileContext): string {
    const { settings, ignoresFor } = context.selection.view;

    return JSON.stringify(
        {
            mode: 'strict',
            minLines: settings['limits.min_duplicate_lines'],
            minTokens: settings['limits.min_duplicate_tokens'],
            absolute: true,
            gitignore: true,
            ignore: [
                ...JSCPD_IGNORED,
                ...ignoresFor('duplication/jscpd')
                    .filter((entry) => entry.rule === undefined)
                    .flatMap((entry) => entry.paths),
            ],
        },
        null,
        JSON_INDENT,
    );
}

export { buildJscpdFile };
