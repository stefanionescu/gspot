// The literal values rules reads: names, patterns, limits, and tables.
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import type { ImportDirectionRole, ImportDirectionRoles } from '#plugin/types/rules.ts';

// No role has a default: the folders of a project are its own, so a role the options leave out matches no file.
export const NO_ROLES: Required<ImportDirectionRoles> = {
    types: [],
    tests: [],
    harness: [],
    config: [],
    env: [],
    runtime: [],
};

export const DEFAULT_CONTRACTS = ['index', 'public', 'contracts'];

export const ROLE_ORDER: ImportDirectionRole[] = ['harness', 'tests', 'types', 'env', 'config', 'runtime'];

export const TEST_ROLES = new Set<ImportDirectionRole>(['tests', 'harness']);

export const CONFIG_ROLES = new Set<ImportDirectionRole>(['config', 'env']);

/** Object and array literals own the structure they construct. */
export const STRUCTURED_EXPRESSIONS = new Set<AST_NODE_TYPES>([
    AST_NODE_TYPES.ObjectExpression,
    AST_NODE_TYPES.ArrayExpression,
]);

/** Nodes that introduce no implementation or owned schema. */
export const FORWARDING_NODES = new Set([
    'ImportDeclaration',
    'ExportAllDeclaration',
    'EmptyStatement',
    'Identifier',
    'MemberExpression',
    'TSDeclareFunction',
]);

export const WRAPPERS = new Set(['ChainExpression', 'TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression']);
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

export const WHITESPACE = /[\t\n\r ]/u;

// File discovery and import resolution.
export const DEFAULT_TEST = String.raw`\.(?:test|spec)\.[cm]?[jt]sx?$`;
export const CODE_EXTENSION = /\.[cm]?[jt]sx?$/u;
export const EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
export const DEFAULT_PREFIXES = ['./', '../', '@/', '#'];
export const DEFAULT_PATTERNS = [
    String.raw`^[@#][\w./-]*/.+/index(?:\.[cm]?[jt]sx?)?$`,
    String.raw`^\.{1,2}(?:/[^/]+)*/index(?:\.[cm]?[jt]sx?)?$`,
    String.raw`^\.{1,2}/index(?:\.[cm]?[jt]sx?)?$`,
];

// Barrel size and trivial statement limits.
export const DEFAULT_MAX = 20;

/** The statement count at or under which a function is trivial, when no option is set. */
export const DEFAULT_TRIVIAL_STATEMENTS = 2;

/** Lines a comment may sit above its declaration: one, or two when a blank line is allowed. */
export const ATTACHED_DISTANCE = 1;
export const BLANK_LINE_DISTANCE = 2;
