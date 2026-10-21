import { getTable } from '#cli/settings/scope-view.ts';
import { JSON_INDENT } from '#cli/config/generation/generate.ts';
import type { PlannedToolFile } from '#cli/types/generation/files.ts';
import { listIgnoredGlobs } from '#cli/generation/settings/ignore-files.ts';
import { JSCPD_IGNORED } from '#cli/config/generation/settings/builders/jscpd.ts';

/**
 * Build the jscpd file from the settings.
 *
 * @param planned the tool file to build.
 * @returns the duplication scan settings and source exclusions.
 */
export function buildJscpdFile(planned: PlannedToolFile): string {
    return JSON.stringify(
        {
            mode: 'strict',
            minLines: getTable(planned.selection.view, 'duplication').min_lines,
            minTokens: getTable(planned.selection.view, 'duplication').min_tokens,
            absolute: true,
            gitignore: true,
            ignore: [
                ...JSCPD_IGNORED,
                ...listIgnoredGlobs(planned.session, planned.selection.view, 'duplication/jscpd'),
            ],
        },
        null,
        JSON_INDENT,
    );
}
