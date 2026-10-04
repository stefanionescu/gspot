import type { YarnOperations } from '#tests/types/cli/tools/npm.ts';

export const YARN_MANAGERS: YarnOperations[] = [
    {
        installer: { name: 'yarn', version: '1.22.22' },
        lock: ['yarn', 'install'],
        install: ['yarn', 'install', '--frozen-lockfile'],
        settings: false,
    },
    {
        installer: { name: 'yarn', version: '4.12.0' },
        lock: ['yarn', 'install', '--mode=update-lockfile'],
        install: ['yarn', 'install', '--immutable'],
        settings: true,
    },
];
