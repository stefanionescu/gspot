// The literal values plugin reads: names, patterns, limits, and tables.
import { SyntaxKind } from 'typescript';
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

/** Expression wrappers preserve the use of a referenced function value. */
export const FUNCTION_REFERENCE_WRAPPERS = new Set([
    SyntaxKind.ParenthesizedExpression,
    SyntaxKind.AsExpression,
    SyntaxKind.TypeAssertionExpression,
    SyntaxKind.SatisfiesExpression,
    SyntaxKind.NonNullExpression,
]);
export const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
/** Object and array literals own the structure they construct. */
export const STRUCTURED_EXPRESSIONS = new Set<AST_NODE_TYPES>([
    AST_NODE_TYPES.ObjectExpression,
    AST_NODE_TYPES.ArrayExpression,
]);
/** Operations whose reuse centralizes a calculation or constructed value. */
export const COMPUTATION_NODES = new Set<AST_NODE_TYPES>([
    AST_NODE_TYPES.BinaryExpression,
    AST_NODE_TYPES.LogicalExpression,
    AST_NODE_TYPES.ConditionalExpression,
    AST_NODE_TYPES.UnaryExpression,
    AST_NODE_TYPES.UpdateExpression,
    AST_NODE_TYPES.AssignmentExpression,
    ...STRUCTURED_EXPRESSIONS,
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
// Alternative re-export policies are selected explicitly.
export const INDEX_ONLY_RULES = new Set(['max-barrel-reexports', 'no-reexports-outside-index']);
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
export const DECLARATION_SUFFIX = '.d.ts';
/** The extensions of code files the rules look at. */
export const CODE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte'];
