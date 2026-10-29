import { JSON_INDENT } from '#cli/config/text.ts';
import { getTable } from '#cli/settings/scopes.ts';
import type { PlannedConfigFile } from '#cli/types/generation/files.ts';

/**
Build purgecss-safelist.json: the selectors of the scope that PurgeCSS keeps, which purgecss.mjs reads.

@param planned the config file to build.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The config-file builder calls it by its target path.
export function buildPurgecssSafelist(planned: PlannedConfigFile): string {
    return JSON.stringify(getTable(planned.scope.settings, 'tools.purgecss').safelist, null, JSON_INDENT);
}
