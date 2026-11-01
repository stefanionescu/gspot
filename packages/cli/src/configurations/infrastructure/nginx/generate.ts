import { listIgnoredRules } from '#cli/settings/scopes.ts';
import { GIXY_CHECK } from '#cli/config/configurations/infrastructure.ts';
import type { PlannedConfig } from '#cli/types/configurations/language.ts';

/**
Build the Gixy exclusions from configured rule ignores.

@param planned the config file and scope.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: CONFIG_BUILDERS selects this configuration's generator through its shared builder interface.
export function buildGixyFile(planned: PlannedConfig): string {
    const off = listIgnoredRules(planned.scope, GIXY_CHECK);
    return off.length === 0 ? '' : `skips = ${off.join(',')}`;
}
