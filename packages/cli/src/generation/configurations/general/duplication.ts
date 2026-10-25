import { JSON_INDENT } from '#cli/config/text.ts';
import { getTable } from '#cli/settings/scopes.ts';
import type { PlannedConfigFile } from '#cli/types/generation/files.ts';
import { convertToGlobs, listIgnoreSections } from '#cli/generation/config-files/ignore-files.ts';
import { JSCPD_IGNORED, JSCPD_IMPORT_PATTERNS } from '#cli/config/generation/configurations/general/duplication.ts';

/**
Build jscpd.json: the duplicate size limits, the skipped import lines, and the ignored paths.

@param planned the config file with its scope, level, and target path.
@returns the jscpd settings.
*/
export function buildJscpdFile(planned: PlannedConfigFile): string {
    const limits = getTable(planned.scope.settings, 'duplication');
    const settings = {
        mode: 'strict',
        minLines: limits.min_lines,
        minTokens: limits.min_tokens,
        absolute: true,
        gitignore: true,
        ignorePattern: JSCPD_IMPORT_PATTERNS,
        ignore: [...JSCPD_IGNORED, ...convertToGlobs(listIgnoreSections(planned, 'duplication/jscpd'))],
    };
    return JSON.stringify(settings, null, JSON_INDENT);
}
