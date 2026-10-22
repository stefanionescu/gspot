import { stringify as stringifyYaml } from 'yaml';
import type { PlannedToolFile } from '#cli/types/generation/files.ts';
import { SPECTRAL_RECOMMENDED_OFF } from '#cli/config/generation/settings/builders/spectral.ts';

/**
 * Build spectral.yml: the OpenAPI preset and the Spectral rules at this level.
 *
 * @param planned the tool file with its scope, level, and target path.
 * @returns the OpenAPI preset and the Spectral rules at this level.
 */
export function buildSpectralFile(planned: PlannedToolFile): string {
    const isAll = planned.level === 'all';

    return stringifyYaml({
        extends: ['spectral:oas'],
        ...(isAll ? {} : { rules: Object.fromEntries(SPECTRAL_RECOMMENDED_OFF.map((name) => [name, 'off'])) }),
    });
}
