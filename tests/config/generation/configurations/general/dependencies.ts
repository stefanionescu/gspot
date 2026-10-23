import type { ManagedKeys } from '#cli/types/apply.ts';

export const BUN_SCANNER_KEYS: ManagedKeys[] = [
    {
        path: 'apps/api/bunfig.toml',
        keys: [{ key: ['install', 'security', 'scanner'], value: '@socketsecurity/bun-security-scanner' }],
    },
];

export const TWO_WEEKS_SECONDS = 1_209_600;
