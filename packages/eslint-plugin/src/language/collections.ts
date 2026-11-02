import { COLLECTION_TYPE_NAMES } from '../config/collections.ts';
import { ASTUtils, TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

/**
List the variables of every scope below the global scope, the scopes whose variables a collection rule inspects.

@param source the source code of the file.
*/
export function listLocalVariables(source: TSESLint.SourceCode): TSESLint.Scope.Variable[] {
    const scopes = source.scopeManager?.scopes ?? [];
    return scopes.filter((scope) => scope.type !== TSESLint.Scope.ScopeType.global).flatMap((scope) => scope.variables);
}

/**
Get the value that a write reference stores, when a declaration or an assignment statement makes the write.

@param reference a write reference of a variable.
@param source the source code of the file.
@returns the initializer or the assigned value, or undefined for any other write.
*/
export function getStoredValue(
    reference: TSESLint.Scope.Reference,
    source: TSESLint.SourceCode,
): TSESTree.Node | undefined {
    const holder = source
        .getAncestors(reference.identifier)
        .findLast(
            ({ type }) => type === AST_NODE_TYPES.VariableDeclarator || type === AST_NODE_TYPES.ExpressionStatement,
        );
    if (holder?.type === AST_NODE_TYPES.VariableDeclarator) return holder.init ?? undefined;
    if (holder?.type !== AST_NODE_TYPES.ExpressionStatement) return undefined;
    const { expression } = holder;
    const isAssignment =
        expression.type === AST_NODE_TYPES.AssignmentExpression && Object.is(expression.left, reference.identifier);
    return isAssignment ? expression.right : undefined;
}

/**
List the items that an array literal or a collection constructor call starts with.

@param node the stored value.
@returns the array elements or the constructor arguments, or undefined when the value creates no collection.
*/
export function listInitialElements(node: TSESTree.Node | undefined): readonly unknown[] | undefined {
    if (node === undefined) return undefined;
    if (node.type === AST_NODE_TYPES.ArrayExpression) return node.elements;
    const isCall = node.type === AST_NODE_TYPES.CallExpression || node.type === AST_NODE_TYPES.NewExpression;
    if (!isCall || !ASTUtils.isIdentifier(node.callee)) return undefined;
    return COLLECTION_TYPE_NAMES.has(node.callee.name) ? node.arguments : undefined;
}
