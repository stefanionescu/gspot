import { listIgnoredRules } from '#cli/settings/scope-settings.ts';
import type { PlannedToolFile } from '#cli/types/generation/files.ts';

/**
 * Build gixy.cfg: the Gixy rule exclusions, or empty text when every rule stays enabled.
 *
 * @param planned the tool file with its scope, level, and target path.
 * @returns the Gixy rule exclusions, or empty text when every rule stays enabled.
 */
export function buildGixyFile(planned: PlannedToolFile): string {
    const off = listIgnoredRules(planned.scope, 'nginx/gixy');
    return off.length === 0 ? '' : `skips = ${off.join(',')}`;
}
