import { JSCPD_CHECK, JSCPD_IGNORED, JSCPD_IMPORT_PATTERNS } from '#cli/config/configurations/structure.ts';
import { JSON_INDENT } from '#cli/config/tools/programs.ts';
import { convertToGlobs, listPlannedIgnoreSections } from '#cli/configurations/ignores.ts';
import { getTable } from '#cli/settings/tables.ts';
import type { ConfigBuilder, PlannedConfig } from '#cli/types/configurations/shared.ts';

function buildJscpdFile(planned: PlannedConfig): string {
    const limits = getTable(planned.scope.settings, 'structure');
    const settings = {
        mode: 'strict',
        minLines: limits.min_duplicate_lines,
        minTokens: limits.min_duplicate_tokens,
        absolute: true,
        gitignore: true,
        ignorePattern: JSCPD_IMPORT_PATTERNS,
        ignore: [
            ...JSCPD_IGNORED,
            ...convertToGlobs(listPlannedIgnoreSections(planned, JSCPD_CHECK)).filter(
                (pattern) => !pattern.startsWith('!'),
            ),
        ],
    };
    return JSON.stringify(settings, null, JSON_INDENT);
}

export const STRUCTURE_CONFIG_BUILDERS: Readonly<Record<string, ConfigBuilder>> = {
    'structure/jscpd.json': buildJscpdFile,
};
