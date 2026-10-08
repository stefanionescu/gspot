import type { PolicyExpiryCase } from '#tests/types/cli/policy/expiry.ts';

/** Native expiry values contain valid calendar dates. */
export const POLICY_EXPIRY_CASES: PolicyExpiryCase[] = [
    { name: 'ordinary date', literal: '2026-12-31', valid: true, date: '2026-12-31' },
    { name: 'leap date', literal: '2024-02-29', valid: true, date: '2024-02-29' },
    { name: 'century leap date', literal: '2000-02-29', valid: true, date: '2000-02-29' },
    { name: 'year zero', literal: '0000-02-29', valid: true, date: '0000-02-29' },
    { name: 'maximum year', literal: '9999-12-31', valid: true, date: '9999-12-31' },
    { name: 'quoted date', literal: '"2026-12-31"', valid: false },
    { name: 'local datetime', literal: '2026-12-31T00:00:00', valid: false },
    { name: 'offset datetime', literal: '2026-12-31T00:00:00Z', valid: false },
    { name: 'offset timezone', literal: '2026-12-31T00:00:00+03:00', valid: false },
    { name: 'local time', literal: '00:00:00', valid: false },
    {
        name: 'invalid leap date',
        literal: '2026-02-29',
        valid: false,
        syntaxError: '"2026-02-29": day 29 invalid for 2026-02',
    },
    {
        name: 'invalid century date',
        literal: '1900-02-29',
        valid: false,
        syntaxError: '"1900-02-29": day 29 invalid for 1900-02',
    },
    {
        name: 'invalid month length',
        literal: '2026-04-31',
        valid: false,
        syntaxError: '"2026-04-31": day 31 invalid for 2026-04',
    },
];

/** A mixed array cannot give an inline field its own TOML 1.0 leading comment. */
export const UNREPRESENTABLE_POLICY_COMMENT =
    '[tools.eslint]\nverbatim={ mixed=[\n {\n # Field-owned comment\n enabled=true\n },\n 2\n] }\n';
