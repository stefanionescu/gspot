import { stringify as stringifyYaml } from 'yaml';

import {
    OWASP_AUTHENTICATION_GROUP,
    OWASP_CREDENTIAL_RULES,
    OWASP_RULESET,
} from '#cli/config/configurations/infrastructure.ts';
import { listDisabledRules } from '#cli/configurations/rule-options.ts';
import type { ConfigBuilder, PlannedConfig } from '#cli/types/configurations/shared.ts';

function buildSpectralFile(planned: PlannedConfig): string {
    const off = listDisabledRules(planned);

    return stringifyYaml({
        extends: ['spectral:oas', [OWASP_RULESET, 'off']],
        rules: {
            ...Object.fromEntries(OWASP_CREDENTIAL_RULES.map((name) => [`${OWASP_AUTHENTICATION_GROUP}${name}`, true])),
            ...Object.fromEntries(off.map((name) => [name, 'off'])),
        },
    });
}

export const OPENAPI_CONFIG_BUILDERS: Readonly<Record<string, ConfigBuilder>> = {
    'openapi/spectral.yml': buildSpectralFile,
};
