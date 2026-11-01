import { getTable } from '#cli/settings/scopes.ts';
import { JSON_INDENT } from '#cli/config/tools/installers.ts';
import type { PlannedConfig } from '#cli/types/configurations/language.ts';

/**
Build the PurgeCSS safelist with the selected names and patterns.

@param planned the config file and scope.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: CONFIG_BUILDERS selects this configuration's generator through its shared builder interface.
export function buildPurgecssSafelistFile(planned: PlannedConfig): string {
    return JSON.stringify(getTable(planned.scope.settings, 'tools.purgecss').safelist, null, JSON_INDENT);
}
