import { FUNCTIONS } from '#plugin/config/syntax.ts';
import type { ImportDirectionRole, ImportDirectionRoles } from '#plugin/types/rules.ts';

// File discovery and import resolution.
export const TEST_PATTERN = String.raw`\.(?:test|spec)\.[cm]?[jt]sx?$`;

/** Test frameworks whose imported expect function performs assertions. */
export const ASSERTION_MODULES = new Set(['bun:test', 'vitest', '@jest/globals']);

/** Files under conventional test directories may own assertions. */
export const TEST_DIRECTORIES = ['**/tests/**', '**/__tests__/**', '**/test/**'];

export const INTERNAL_PREFIXES = ['./', '../', '@/', '#'];

export const EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];

export const DECLARATIONS = new Set([
    'FunctionDeclaration',
    'ClassDeclaration',
    'VariableDeclaration',
    'TSTypeAliasDeclaration',
    'TSInterfaceDeclaration',
    'TSEnumDeclaration',
    'TSModuleDeclaration',
]);

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

// Barrel size and trivial statement limits.
export const MAX_REEXPORTS = 20;

/** Test framework calls that load a named module. */
export const MODULE_MOCK_METHODS = {
    vi: new Set(['mock', 'doMock', 'importActual']),
    jest: new Set(['mock', 'doMock', 'requireActual']),
};

/** Object and array literals own the structure they construct. */
export const STRUCTURED_EXPRESSIONS = new Set<string>(['ObjectExpression', 'ArrayExpression']);

/** Nodes that introduce no implementation or owned schema. */
export const FORWARDING_NODES = new Set([
    ...FUNCTIONS,
    'ImportDeclaration',
    'ExportAllDeclaration',
    'EmptyStatement',
    'Identifier',
    'MemberExpression',
    'TSDeclareFunction',
]);

/** JavaScript value constructors do not imply a shared application service. */
export const VALUE_CONSTRUCTORS = new Set(['Set', 'Map', 'WeakMap', 'WeakSet', 'RegExp', 'URL', 'Date', 'Error']);

/** Registry files accepted by the explicitly selected singleton rule. */
export const REGISTRY_FILES = ['**/registry.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'];
