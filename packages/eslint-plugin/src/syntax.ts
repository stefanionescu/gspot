import type { ImplementedFunction } from './types/syntax.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    TYPE_ONLY,
    DRIVE_LETTER,
    FUNCTION_TYPES,
    UNWRAPPABLE_NODES,
    EXECUTABLE_DECLARATIONS,
    TRANSPARENT_EXPRESSIONS,
    NON_EXECUTABLE_STATEMENTS,
} from './config/syntax.ts';

const isUnwrappable = ASTUtils.isNodeOfTypes(UNWRAPPABLE_NODES.map((type) => AST_NODE_TYPES[type]));

const isTransparentExpression = ASTUtils.isNodeOfTypes(TRANSPARENT_EXPRESSIONS.map((type) => AST_NODE_TYPES[type]));

function listChildNodes(
    node: TSESTree.Node,
    visitorKeys: Readonly<Record<string, readonly string[]>>,
): TSESTree.Node[] {
    return (visitorKeys[node.type] ?? []).flatMap((key) => {
        const child: unknown = node[key as keyof TSESTree.Node];
        if (Array.isArray(child)) return child.filter((nested: unknown) => nested !== null) as TSESTree.Node[];
        return child !== null && typeof child === 'object' ? [child as TSESTree.Node] : [];
    });
}

/**
Walk through type assertions and conditional or logical expressions to the outermost value.

@param node the expression
@returns the outermost expression that wraps it
*/
export function findOutermostValue(node: TSESTree.Expression): TSESTree.Expression {
    let value = node;
    while (isTransparentExpression(value.parent)) value = value.parent;
    return value;
}

/**
Count the executable statements under a node, nested functions included. An expression body counts as one.

@param node the function body, or anything inside it
@param visitorKeys the child keys of each node type, from the parser
@returns the statement count
*/
export function countStatements(node: TSESTree.Node, visitorKeys: Readonly<Record<string, readonly string[]>>): number {
    if (TYPE_ONLY.has(node.type)) return 0;
    if ('declare' in node && node.declare) return 0;
    const isExpressionBody =
        FUNCTION_TYPES.has(node.type) && (node as ImplementedFunction).body.type !== AST_NODE_TYPES.BlockStatement;
    const isStatement = node.type.endsWith('Statement') && !NON_EXECUTABLE_STATEMENTS.has(node.type);
    const own = Number(isExpressionBody || isStatement || EXECUTABLE_DECLARATIONS.has(node.type));
    return listChildNodes(node, visitorKeys).reduce((total, child) => total + countStatements(child, visitorKeys), own);
}

/**
Strip the wrappers that keep the runtime value: type assertions and optional chains.

@param node the expression, or null
@returns the inner expression
*/
export function unwrap(node: TSESTree.Node | null): TSESTree.Node | null {
    let value = node;
    while (value !== null && isUnwrappable(value)) value = value.expression;
    return value;
}

/**
Identify a direct alias of a value bound in this module.

@param node the expression assigned to another name
@param scope the expression's lexical scope
@returns whether the expression only selects a bound value
*/
export function isAlias(node: TSESTree.Node | null, scope: TSESLint.Scope.Scope): boolean {
    let value = unwrap(node);
    while (value?.type === AST_NODE_TYPES.MemberExpression && !value.computed) value = unwrap(value.object);
    return value?.type === AST_NODE_TYPES.Identifier && (ASTUtils.findVariable(scope, value)?.defs.length ?? 0) > 0;
}

/**
Normalize separators and drive casing before comparing repository paths.

@param path the operating system path
@returns the comparable POSIX path
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The rule in the plugin source does not report it.
export function convertToPosixPath(path: string): string {
    return path.replaceAll('\\', '/').replace(DRIVE_LETTER, (drive) => drive.toUpperCase());
}
