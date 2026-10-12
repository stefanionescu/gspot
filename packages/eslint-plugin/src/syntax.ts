import type { ImplementedFunction } from './types/syntax.ts';
import { ASTUtils, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    WRAPPERS,
    FUNCTIONS,
    TYPE_ONLY,
    COMPARISON_OPERATORS,
    EXECUTABLE_DECLARATIONS,
    NON_EXECUTABLE_STATEMENTS,
} from './config/syntax.ts';

// Read syntax children through the parser visitor keys. Exclude metadata and parent links.
function childNodes(node: TSESTree.Node, visitorKeys: Readonly<Record<string, readonly string[]>>): TSESTree.Node[] {
    return (visitorKeys[node.type] ?? []).flatMap((key) => {
        const child: unknown = node[key as keyof TSESTree.Node];
        if (Array.isArray(child)) return child.filter((item: unknown) => item !== null) as TSESTree.Node[];
        return child !== null && typeof child === 'object' ? [child as TSESTree.Node] : [];
    });
}

// Only values that depend on an expression count as calculations; literal and identity returns stay trivial.
function constructsDynamicValue(node: TSESTree.Node): boolean {
    switch (node.type) {
        case AST_NODE_TYPES.ConditionalExpression:
        case AST_NODE_TYPES.LogicalExpression: {
            return true;
        }
        case AST_NODE_TYPES.BinaryExpression: {
            return COMPARISON_OPERATORS.has(node.operator);
        }
        case AST_NODE_TYPES.TemplateLiteral: {
            return node.expressions.length > 0;
        }
        case AST_NODE_TYPES.ObjectExpression: {
            return node.properties.some(
                (property) =>
                    property.type === AST_NODE_TYPES.SpreadElement || property.value.type !== AST_NODE_TYPES.Literal,
            );
        }
        case AST_NODE_TYPES.ArrayExpression: {
            return node.elements.some((element) => element !== null && element.type !== AST_NODE_TYPES.Literal);
        }
        default: {
            return false;
        }
    }
}

// Compositions transform an earlier operation's result rather than forwarding one call unchanged.
function combinesOperations(node: TSESTree.CallExpression): boolean {
    return (
        (node.callee.type === AST_NODE_TYPES.MemberExpression &&
            node.callee.object.type === AST_NODE_TYPES.CallExpression &&
            node.callee.object.callee.type === AST_NODE_TYPES.MemberExpression) ||
        node.arguments.some((argument) => unwrap(argument)?.type === AST_NODE_TYPES.CallExpression)
    );
}

/**
 * Count the executable statements under a node, those of the functions written inside it included. An expression
 * body counts as one statement.
 * @param node the function implementation, or a node inside it
 * @param visitorKeys the child keys of each node type, from the parser
 * @returns the count
 */
export function totalStatements(node: TSESTree.Node, visitorKeys: Readonly<Record<string, readonly string[]>>): number {
    if (TYPE_ONLY.has(node.type)) return 0;
    if ('declare' in node && node.declare) return 0;
    const isExpressionBody =
        FUNCTIONS.has(node.type) && (node as ImplementedFunction).body.type !== AST_NODE_TYPES.BlockStatement;
    const isStatement = node.type.endsWith('Statement') && !NON_EXECUTABLE_STATEMENTS.has(node.type);
    const own = [isExpressionBody, isStatement, EXECUTABLE_DECLARATIONS.has(node.type)].includes(true) ? 1 : 0;
    return childNodes(node, visitorKeys).reduce((total, child) => total + totalStatements(child, visitorKeys), own);
}

/**
 * Identify constructors whose parameters or assignments initialize instance state.
 * @param node the implemented function
 * @returns whether removing the constructor loses its instance initialization contract
 */
export function hasConstructorState(node: ImplementedFunction): boolean {
    if (node.parent.type !== AST_NODE_TYPES.MethodDefinition || node.parent.kind !== 'constructor') return false;
    if (node.params.some((parameter) => parameter.type === AST_NODE_TYPES.TSParameterProperty)) return true;
    if (node.body.type !== AST_NODE_TYPES.BlockStatement) return false;
    return node.body.body.some(
        (statement) =>
            statement.type === AST_NODE_TYPES.ExpressionStatement &&
            statement.expression.type === AST_NODE_TYPES.AssignmentExpression &&
            statement.expression.left.type === AST_NODE_TYPES.MemberExpression &&
            statement.expression.left.object.type === AST_NODE_TYPES.ThisExpression,
    );
}

/**
 * Read an expression through syntax wrappers that preserve its runtime value.
 * @param node the expression under inspection
 * @returns the expression after static assertions and optional chaining wrappers
 */
export function unwrap(node: TSESTree.Node | null): TSESTree.Node | null {
    let value = node;
    const canUnwrap = ASTUtils.isNodeOfTypes(WRAPPERS.map((type) => AST_NODE_TYPES[type]));
    while (value !== null && canUnwrap(value)) value = value.expression;
    return value;
}

/**
 * Detect constructed data, predicate selection, and composed operations. Exclude constants and plain forwarding.
 * @param node the function body or returned expression
 * @param visitorKeys the parser's child keys
 * @returns whether the expression constructs data, selects a value, or combines operations
 */
export function ownsCalculation(
    node: TSESTree.Node,
    visitorKeys: Readonly<Record<string, readonly string[]>>,
): boolean {
    if (constructsDynamicValue(node)) return true;
    if (node.type === AST_NODE_TYPES.CallExpression && combinesOperations(node)) return true;
    return childNodes(node, visitorKeys).some((child) => ownsCalculation(child, visitorKeys));
}
