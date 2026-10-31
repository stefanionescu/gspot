import { stringify as stringifyYaml } from 'yaml';
import type { PlannedConfig } from '#cli/types/generation/files.ts';
import { SPECTRAL_DEFAULT_LEVEL_OFF } from '#cli/config/generation/configurations/infrastructure.ts';

/**
Build spectral.yml: the OpenAPI preset and the Spectral rules at this level.

@param planned the config file to build.
*/
export function buildSpectralFile(planned: PlannedConfig): string {
    const isAll = planned.level === 'all';

    return stringifyYaml({
        extends: ['spectral:oas'],
        ...(!isAll && { rules: Object.fromEntries(SPECTRAL_DEFAULT_LEVEL_OFF.map((name) => [name, 'off'])) }),
    });
}
