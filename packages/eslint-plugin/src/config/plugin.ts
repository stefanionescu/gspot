// The literal values plugin reads: names, patterns, limits, and tables.
import { AST_NODE_TYPES } from '@typescript-eslint/utils';

/** Executable statements exclude block containers and empty syntax. */
export const EXECUTABLE_STATEMENTS = new Set([
    ...Object.values(AST_NODE_TYPES).filter(
        (type) =>
            type.endsWith('Statement') &&
            type !== AST_NODE_TYPES.BlockStatement &&
            type !== AST_NODE_TYPES.EmptyStatement,
    ),
    AST_NODE_TYPES.VariableDeclaration,
    AST_NODE_TYPES.TSEnumDeclaration,
    AST_NODE_TYPES.ClassDeclaration,
]);

export const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
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
export const TYPE_ONLY = new Set(['TSInterfaceDeclaration', 'TSTypeAliasDeclaration', 'TSDeclareFunction']);
// The rules a caller selects itself: the barrel limit fits an index re-export policy, and the Next.js configuration selects server files.
export const EXPLICIT_RULES = new Set(['max-barrel-reexports', 'require-server-only']);
export const ENVIRONMENT_HOSTS = new Set(['process', 'Bun', 'Deno']);
export const INDEX_BASENAMES = new Set([
    'index.ts',
    'index.tsx',
    'index.js',
    'index.jsx',
    'index.mjs',
    'index.cjs',
    'index.mts',
    'index.cts',
]);
export const STDIN_NAMES = new Set(['', '<input>', '<text>']);
export const FILE_SCHEME = 'file://';
