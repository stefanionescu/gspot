import { listIgnoredRules } from '#cli/settings/scope-view.ts';
import type { PlannedToolFile } from '#cli/types/generation/files.ts';

/**
 * Build the Gixy file from the settings.
 *
 * @param planned the tool file to build.
 * @returns the Gixy rule exclusions, or empty text when every rule stays enabled.
 */
export function buildGixyFile(planned: PlannedToolFile): string {
    const off = listIgnoredRules(planned.selection, 'nginx/gixy');
    return off.length === 0 ? '' : `skips = ${off.join(',')}`;
}
