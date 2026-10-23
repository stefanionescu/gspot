import { listIgnoredRules } from '#cli/settings/scopes.ts';
import type { PlannedConfigFile } from '#cli/types/generation/files.ts';

/**
 * Build gixy.cfg: the Gixy rule exclusions, or empty text when every rule stays enabled.
 *
 * @param planned the config file with its scope, level, and target path.
 * @returns the Gixy rule exclusions, or empty text when every rule stays enabled.
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The config-file builder calls it by its target path.
export function buildGixyFile(planned: PlannedConfigFile): string {
    const off = listIgnoredRules(planned.scope, 'nginx/gixy');
    return off.length === 0 ? '' : `skips = ${off.join(',')}`;
}
