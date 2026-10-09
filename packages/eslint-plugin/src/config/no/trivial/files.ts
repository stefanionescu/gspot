import { FUNCTIONS } from '#plugin/config/syntax.ts';

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
