import type { ImportDirectionRole, ImportDirectionRoles } from '#plugin/types/import-direction.ts';

// No role has a default: the folders of a project are its own, so a role the options leave out matches no file.
export const NO_ROLES: Required<ImportDirectionRoles> = {
    types: [],
    tests: [],
    harness: [],
    config: [],
    env: [],
    runtime: [],
};

export const CONTRACTS = ['public', 'contracts'];

export const ROLE_ORDER: (keyof ImportDirectionRoles)[] = ['harness', 'tests', 'types', 'env', 'config', 'runtime'];

export const TEST_ROLES = new Set<ImportDirectionRole>(['tests', 'harness']);

export const CONFIG_ROLES = new Set<ImportDirectionRole>(['config', 'env']);
