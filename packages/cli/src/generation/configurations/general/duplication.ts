import { JSON_INDENT } from '#cli/config/text.ts';
import { getTable } from '#cli/settings/scopes.ts';
import type { PlannedConfigFile } from '#cli/types/generation/files.ts';
import { JSCPD_CHECK, JSCPD_IGNORED, JSCPD_IMPORT_PATTERNS } from '#cli/config/generation/configurations/general.ts';

import {
    convertToGlobs,
    buildIgnoreSections,
    listCheckIgnoreSections,
} from '#cli/generation/config-files/ignore-files.ts';

/**
Build jscpd.json: the duplicate size limits, the skipped import lines, and the ignored paths.

@param planned the config file to build.
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
        ignore: [
            ...JSCPD_IGNORED,
            ...convertToGlobs([
                ...buildIgnoreSections(planned.session),
                ...listCheckIgnoreSections(planned.scope.settings, JSCPD_CHECK),
            ]).filter((pattern) => !pattern.startsWith('!')),
        ],
    };
    return JSON.stringify(settings, null, JSON_INDENT);
}
