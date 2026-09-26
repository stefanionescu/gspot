import type { ImportDirectionRole, ImportDirectionRoles } from '#plugin/types/rules.ts';

export const DEFAULT_ROLES: Required<ImportDirectionRoles> = {
    types: ['**/types/**'],
    tests: ['tests/**', '**/*.test.*', '**/*.spec.*', '**/__tests__/**'],
    harness: ['tests/support/**'],
    config: ['config/**'],
    env: ['src/env/**'],
    runtime: ['src/**'],
};

export const DEFAULT_CONTRACTS = ['index', 'public', 'contracts'];

export const ROLE_ORDER: ImportDirectionRole[] = ['harness', 'tests', 'types', 'env', 'config', 'runtime'];

export const TEST_ROLES = new Set<ImportDirectionRole>(['tests', 'harness']);

export const CONFIG_ROLES = new Set<ImportDirectionRole>(['config', 'env']);
