import type { Level } from '#cli/types/settings.ts';

// ansible checks
export const ANSIBLE_CONFIG_EXTENSION = '.cfg';
export const ANSIBLE_CONFIG_FILE = 'ansible.cfg';

// ansible generated config
export const LEVEL_PROFILES: Readonly<Record<Level, string>> = { basic: 'moderate', all: 'production' };

// openapi generated config
export const OWASP_AUTHENTICATION_GROUP = 'owasp:api2:2023-';
/**
The OWASP rules that find credentials an attacker can read or replay, from its authentication group. The rest of the set
asks for API design choices, such as rate-limit headers on every response, so it stays off.
*/
export const OWASP_CREDENTIAL_RULES = [
    'auth-insecure-schemes',
    'no-api-keys-in-url',
    'no-credentials-in-url',
    'no-http-basic',
];
export const OWASP_RULESET = '@stoplight/spectral-owasp-ruleset';
