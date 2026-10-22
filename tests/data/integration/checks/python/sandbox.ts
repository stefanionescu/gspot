import { BASE_INSTALLED_FILES } from '#tests/data/setup/sandboxes.ts';

export const RUFF_SANDBOX = {
    configurations: ['python', 'pytest'],
    level: 'all',
    files: BASE_INSTALLED_FILES,
} as const;
