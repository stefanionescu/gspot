import type { ImportDirectionOptions } from '#plugin/types/rules.ts';

export const ALIASES = { '@/': 'src/', '@tests/': 'tests/', '@config/': 'config/', '@app-types/': 'types/' };

export const ROLES = {
    types: ['types/**'],
    tests: ['tests/**', '**/*.test.*'],
    harness: ['tests/harness/**'],
    config: ['config/**'],
    env: ['src/env/**'],
    runtime: ['src/**'],
};

export const OPTIONS: ImportDirectionOptions = [{ roles: ROLES, aliases: ALIASES }];
