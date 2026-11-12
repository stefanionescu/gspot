import { stringify as stringifyYaml } from 'yaml';

import { listDisabledRules } from '#cli/configurations/rule-options.ts';
import type { ConfigBuilder, PlannedConfig } from '#cli/types/configurations/shared.ts';

const OWASP_RULESET = '@stoplight/spectral-owasp-ruleset';

const OWASP_AUTHENTICATION_GROUP = 'owasp:api2:2023-';

/**
The OWASP rules that find credentials an attacker can read or replay, from its authentication group. The rest of the set
asks for API design choices, such as rate-limit headers on every response, so it stays off.
*/
const OWASP_CREDENTIAL_RULES = [
    'auth-insecure-schemes',
    'no-api-keys-in-url',
    'no-credentials-in-url',
    'no-http-basic',
];

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
