import type { ImportDirectionInput } from '#tests/types/plugin/rules/import-direction.ts';

export const ALIASES = { '@/': 'src/', '@tests/': 'tests/', '@config/': 'config/', '@app-types/': 'types/' };

export const ROLES = {
    types: ['types/**'],
    tests: ['tests/**', '**/*.test.*'],
    harness: ['tests/harness/**'],
    config: ['config/**'],
    env: ['src/env/**'],
    runtime: ['src/**'],
};

export const OPTIONS: ImportDirectionInput = [{ roles: ROLES, aliases: ALIASES }];
