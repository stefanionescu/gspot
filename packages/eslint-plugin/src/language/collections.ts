import { AST_NODE_TYPES, ASTUtils, TSESLint, type TSESTree } from '@typescript-eslint/utils';

import { COLLECTION_TYPE_NAMES } from '../config/collections.ts';

export function listLocalVariables(source: TSESLint.SourceCode): TSESLint.Scope.Variable[] {
    const scopes = source.scopeManager?.scopes ?? [];
    return scopes.filter((scope) => scope.type !== TSESLint.Scope.ScopeType.global).flatMap((scope) => scope.variables);
}

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

export function listInitialElements(node: TSESTree.Node | undefined): readonly unknown[] | undefined {
    if (node === undefined) return undefined;
    if (node.type === AST_NODE_TYPES.ArrayExpression) return node.elements;
    const isCall = node.type === AST_NODE_TYPES.CallExpression || node.type === AST_NODE_TYPES.NewExpression;
    if (!isCall || !ASTUtils.isIdentifier(node.callee)) return undefined;
    return COLLECTION_TYPE_NAMES.has(node.callee.name) ? node.arguments : undefined;
}
