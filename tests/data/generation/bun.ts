import type { ManagedKeys } from '#cli/types/ownership.ts';

/** The managed scanner key of a Bun scope. */
export const BUN_SCANNER_KEYS: ManagedKeys[] = [
    {
        path: 'apps/api/bunfig.toml',
        keys: [{ key: ['install', 'security', 'scanner'], value: '@socketsecurity/bun-security-scanner' }],
    },
];

/** A hold of fourteen days that the user wrote in bunfig.toml. */
export const TWO_WEEKS_SECONDS = 1_209_600;
