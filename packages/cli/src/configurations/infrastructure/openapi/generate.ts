import { stringify as stringifyYaml } from 'yaml';

import { listDisabledRules } from '#cli/configurations/rule-options.ts';
import type { ConfigBuilder } from '#cli/types/configurations/general.ts';
import type { PlannedConfig } from '#cli/types/configurations/language.ts';

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
