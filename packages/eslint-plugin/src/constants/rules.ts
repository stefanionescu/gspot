// The literal values rules reads: names, patterns, limits, and tables.
import type { ImportDirectionRole, ImportDirectionRoles } from '#plugin/types/rules.ts';

export const WRAPPERS = new Set(['ChainExpression', 'TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression']);
export const DEFAULT_PREFIXES = ['./', '../', '@/', '#'];
export const DIRECTIVE_PREFIXES = [
    'eslint',
    'global ',
    'globals ',
    'exported ',
    'jshint ',
    'jslint ',
    'istanbul ',
    'c8 ',
    'v8 ',
    '@vitest',
    '@jest',
    'biome-ignore',
    'oxlint-',
];
export const TS_DIRECTIVE = /^@?ts-(?:ignore|expect-error|nocheck|check)\b/u;
export const BLANK = /^\s*$/u;
export const BLANK_LINE = /\n\s*\n/u;
export const LEADING_STAR = /^\s*\*?/u;
export const WHITESPACE = /[\t\n\r ]/u;
export const DECLARATIONS = new Set([
    'FunctionDeclaration',
    'ClassDeclaration',
    'VariableDeclaration',
    'TSTypeAliasDeclaration',
    'TSInterfaceDeclaration',
    'TSEnumDeclaration',
    'TSModuleDeclaration',
]);
export const TYPE_DECLARATIONS = new Set([
    'TSTypeAliasDeclaration',
    'TSInterfaceDeclaration',
    'TSModuleDeclaration',
    'TSDeclareFunction',
]);
export const DEFAULT_IGNORED = ['node_modules', 'dist', 'build', 'coverage', '.git'];
export const DEFAULT_TEST = String.raw`\.(?:test|spec)\.[cm]?[jt]sx?$`;
export const CODE_FILE = /\.[cm]?[jt]sx?$/u;
export const SPACES = /\s+/gu;
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
export const CODE_EXTENSION = /\.[cm]?[jt]sx?$/u;
export const SKIPPED = new Set(['ImportDeclaration', 'TSImportEqualsDeclaration', 'EmptyStatement']);
export const DEFAULT_MAX = 20;
export const EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
export const DECLARATION_KINDS = new Set([
    'function',
    'function*',
    'class',
    'const',
    'let',
    'var',
    'type',
    'interface',
    'enum',
    'async',
]);
export const WORD = /^[A-Za-z_$][\w$]*/u;
export const DEFAULT_THRESHOLD = 2;
export const DEFAULT_PATTERNS = [
    String.raw`^[@#][\w./-]*/.+/index(?:\.[cm]?[jt]sx?)?$`,
    String.raw`^\.{1,2}(?:/[^/]+)*/index(?:\.[cm]?[jt]sx?)?$`,
    String.raw`^\.{1,2}/index(?:\.[cm]?[jt]sx?)?$`,
];
