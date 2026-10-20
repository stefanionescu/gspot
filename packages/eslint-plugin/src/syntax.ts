import type { NamedFunction, ImplementedFunction } from './types/syntax.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    FUNCTIONS,
    TYPE_ONLY,
    EXPORT_REFERENCES,
    UNWRAPPABLE_NODES,
    COMPARISON_OPERATORS,
    EXECUTABLE_DECLARATIONS,
    NON_EXECUTABLE_STATEMENTS,
} from './config/syntax.ts';

// Walk only the visitor keys of the parser, which leave out metadata and parent links.
function listChildNodes(
    node: TSESTree.Node,
    visitorKeys: Readonly<Record<string, readonly string[]>>,
): TSESTree.Node[] {
    return (visitorKeys[node.type] ?? []).flatMap((key) => {
        const child: unknown = node[key as keyof TSESTree.Node];
        if (Array.isArray(child)) return child.filter((item: unknown) => item !== null) as TSESTree.Node[];
        return child !== null && typeof child === 'object' ? [child as TSESTree.Node] : [];
    });
}

// Only values that depend on an expression count as calculations; literal and identity returns stay trivial.
function isDynamicValue(node: TSESTree.Node): boolean {
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

// A composition transforms an earlier result instead of forwarding one call unchanged.
function isComposedCall(node: TSESTree.CallExpression): boolean {
    return (
        (node.callee.type === AST_NODE_TYPES.MemberExpression &&
            node.callee.object.type === AST_NODE_TYPES.CallExpression &&
            node.callee.object.callee.type === AST_NODE_TYPES.MemberExpression) ||
        node.arguments.some((argument) => unwrap(argument)?.type === AST_NODE_TYPES.CallExpression)
    );
}

/**
 * Count the executable statements under a node, nested functions included. An expression body counts as one.
 *
 * @param node the function body, or anything inside it
 * @param visitorKeys the child keys of each node type, from the parser
 * @returns the statement count
 */
export function countStatements(node: TSESTree.Node, visitorKeys: Readonly<Record<string, readonly string[]>>): number {
    if (TYPE_ONLY.has(node.type)) return 0;
    if ('declare' in node && node.declare) return 0;
    const isExpressionBody =
        FUNCTIONS.has(node.type) && (node as ImplementedFunction).body.type !== AST_NODE_TYPES.BlockStatement;
    const isStatement = node.type.endsWith('Statement') && !NON_EXECUTABLE_STATEMENTS.has(node.type);
    const own = [isExpressionBody, isStatement, EXECUTABLE_DECLARATIONS.has(node.type)].includes(true) ? 1 : 0;
    return listChildNodes(node, visitorKeys).reduce((total, child) => total + countStatements(child, visitorKeys), own);
}

/**
 * Check whether a constructor sets instance state through parameter properties or `this` assignments.
 *
 * @param node the function to check
 * @returns whether the constructor sets instance state
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
 * Strip the wrappers that keep the runtime value: type assertions and optional chains.
 *
 * @param node the expression, or null
 * @returns the inner expression
 */
export function unwrap(node: TSESTree.Node | null): TSESTree.Node | null {
    let value = node;
    const canUnwrap = ASTUtils.isNodeOfTypes(UNWRAPPABLE_NODES.map((type) => AST_NODE_TYPES[type]));
    while (value !== null && canUnwrap(value)) value = value.expression;
    return value;
}

/**
 * Check whether an expression builds data, selects a value, or composes calls. Constants and plain forwarding do
 * not count.
 *
 * @param node the function body or returned expression
 * @param visitorKeys the child keys of each node type, from the parser
 * @returns whether the expression calculates something
 */
export function hasCalculation(node: TSESTree.Node, visitorKeys: Readonly<Record<string, readonly string[]>>): boolean {
    if (isDynamicValue(node)) return true;
    if (node.type === AST_NODE_TYPES.CallExpression && isComposedCall(node)) return true;
    return listChildNodes(node, visitorKeys).some((child) => hasCalculation(child, visitorKeys));
}

/**
 * List the variables through which callers reach a function: its own name, or the variable that holds it.
 *
 * @param node the function implementation
 * @param source the parsed file, with its scopes
 * @returns the declared variables of the function
 */
export function listCallableVariables(
    node: ImplementedFunction,
    source: TSESLint.SourceCode,
): TSESLint.Scope.Variable[] {
    const owners: NamedFunction[] = [];
    if (node.type !== AST_NODE_TYPES.ArrowFunctionExpression && node.id !== null) owners.push({ node, id: node.id });
    if (node.parent.type === AST_NODE_TYPES.VariableDeclarator) owners.push({ node: node.parent, id: node.parent.id });
    return owners.flatMap(({ node: owner, id }) =>
        source
            .getDeclaredVariables(owner)
            .filter((variable) => variable.identifiers.some((entry) => entry.range[0] === id?.range[0])),
    );
}

/**
 * Check whether the module exports a function: in its declaration, in an export list, or as the default export.
 * Callers in other modules can use it.
 *
 * @param node the function implementation
 * @param source the parsed file, with its scopes
 * @returns whether the module exports the function
 */
export function isExportedFunction(node: ImplementedFunction, source: TSESLint.SourceCode): boolean {
    const owner = node.parent.type === AST_NODE_TYPES.VariableDeclarator ? node.parent.parent : node;
    if (
        owner.parent.type === AST_NODE_TYPES.ExportNamedDeclaration ||
        owner.parent.type === AST_NODE_TYPES.ExportDefaultDeclaration
    )
        return true;
    return listCallableVariables(node, source).some((variable) =>
        variable.references.some(
            (reference) => reference.isRead() && EXPORT_REFERENCES.has(reference.identifier.parent.type),
        ),
    );
}

/**
 * Check whether a function declares a type predicate as its return type, such as `value is string`.
 *
 * @param node the function implementation
 * @returns whether the function narrows the type of an argument
 */
export function isTypePredicate(node: ImplementedFunction): boolean {
    return node.returnType?.typeAnnotation.type === AST_NODE_TYPES.TSTypePredicate;
}
