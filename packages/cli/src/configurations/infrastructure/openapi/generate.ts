import { stringify as stringifyYaml } from 'yaml';

import { listDisabledRules } from '#cli/configurations/rule-options.ts';
import type { ConfigBuilder } from '#cli/types/configurations/general.ts';
import type { PlannedConfig } from '#cli/types/configurations/language.ts';

/**
Build spectral.yml: the OpenAPI preset and the Spectral rules at this level.

@param planned the config file to build.
*/
function buildSpectralFile(planned: PlannedConfig): string {
    const off = listDisabledRules(planned);

    return stringifyYaml({
        extends: ['spectral:oas'],
        ...(off.length > 0 && { rules: Object.fromEntries(off.map((name) => [name, 'off'])) }),
    });
}

export const OPENAPI_CONFIG_BUILDERS: Readonly<Record<string, ConfigBuilder>> = {
    'openapi/spectral.yml': buildSpectralFile,
};
