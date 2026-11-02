import { stringify as stringifyYaml } from 'yaml';
import { listDisabledRules } from '#cli/configurations/rule-options.ts';
import type { PlannedConfig } from '#cli/types/configurations/language.ts';

/**
Build spectral.yml: the OpenAPI preset and the Spectral rules at this level.

@param planned the config file to build.
*/
export function buildSpectralFile(planned: PlannedConfig): string {
    const off = listDisabledRules(planned);

    return stringifyYaml({
        extends: ['spectral:oas'],
        ...(off.length > 0 && { rules: Object.fromEntries(off.map((name) => [name, 'off'])) }),
    });
}
