import { type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import type { ValueOperand, ImplementedFunction } from '#plugin/types/syntax.ts';

import {
    WRAPPERS,
    FUNCTIONS,
    TYPE_ONLY,
    EXECUTABLE_DECLARATIONS,
    NON_EXECUTABLE_STATEMENTS,
} from '#plugin/config/syntax.ts';

// Read syntax children through the parser visitor keys. Metadata and parent links are excluded.
function childNodes(node: TSESTree.Node, visitorKeys: Readonly<Record<string, readonly string[]>>): TSESTree.Node[] {
    return (visitorKeys[node.type] ?? []).flatMap((key) => {
        const child: unknown = node[key as keyof TSESTree.Node];
        if (Array.isArray(child)) return child.filter((item: unknown) => item !== null) as TSESTree.Node[];
        return child !== null && typeof child === 'object' ? [child as TSESTree.Node] : [];
    });
}

function getBindingNames(pattern: TSESTree.Node): string[] {
    switch (pattern.type) {
        case AST_NODE_TYPES.Identifier: {
            return [pattern.name];
        }
        case AST_NODE_TYPES.ArrayPattern: {
            return pattern.elements.flatMap((element) => (element === null ? [] : getBindingNames(element)));
        }
        case AST_NODE_TYPES.ObjectPattern: {
            return pattern.properties.flatMap((property) =>
                getBindingNames(property.type === AST_NODE_TYPES.RestElement ? property.argument : property.value),
            );
        }
        case AST_NODE_TYPES.AssignmentPattern: {
            return getBindingNames(pattern.left);
        }
        case AST_NODE_TYPES.RestElement: {
            return getBindingNames(pattern.argument);
        }
        default: {
            return [];
        }
    }
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
    while (value !== null && WRAPPERS.has(value.type)) value = (value as ValueOperand).expression;
    return value;
}

/**
 * Read the names introduced by a declaration, including destructured variable bindings.
 * @param declaration the declaration, or null for an export list
 * @returns declared identifier names in source order
 */
export function getDeclarationNames(declaration: TSESTree.Node | null): string[] {
    if (!declaration) return [];
    if ('id' in declaration && declaration.id?.type === AST_NODE_TYPES.Identifier) return [declaration.id.name];
    if (declaration.type === AST_NODE_TYPES.VariableDeclaration)
        return declaration.declarations.flatMap((entry) => getBindingNames(entry.id));
    return [];
}
