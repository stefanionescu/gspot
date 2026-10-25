import type { ManagedKeys } from '#cli/types/write.ts';

export const BUN_SCANNER_KEYS: ManagedKeys[] = [
    {
        path: 'apps/api/bunfig.toml',
        keys: [{ key: ['install', 'security', 'scanner'], value: '@socketsecurity/bun-security-scanner' }],
    },
];
