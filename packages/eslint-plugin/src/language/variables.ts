import { AST_NODE_TYPES, ASTUtils, TSESLint, type TSESTree } from '@typescript-eslint/utils';

import type { MemberAssignment } from '../types/plugin.ts';
import { unwrapExpression } from './syntax.ts';

function getOutermostMember(node: TSESTree.Node): TSESTree.Node {
    let outer = node;
    while (outer.parent?.type === AST_NODE_TYPES.MemberExpression && outer.parent.object === outer)
        outer = outer.parent;
    return outer;
}

function isMemberWrite(member: TSESTree.Node): boolean {
    const { parent } = member;
    if (parent === undefined || member.type !== AST_NODE_TYPES.MemberExpression) return false;
    return (
        (parent.type === AST_NODE_TYPES.AssignmentExpression && parent.left === member) ||
        parent.type === AST_NODE_TYPES.UpdateExpression ||
        (parent.type === AST_NODE_TYPES.UnaryExpression && parent.operator === 'delete')
    );
}

export function getAssignedValue(variable: TSESLint.Scope.Variable): TSESTree.Node | undefined {
    const writes = variable.references.filter((reference) => reference.isWrite());
    return writes.length === 1 ? (writes[0]?.writeExpr ?? undefined) : undefined;
}

export function findAssignedVariable(node: TSESTree.Node, source: TSESLint.SourceCode): TSESLint.Scope.Variable | null {
    const { parent } = node;
    let target: TSESTree.Node | null = null;
    if (parent?.type === AST_NODE_TYPES.VariableDeclarator) target = parent.id;
    else if (parent?.type === AST_NODE_TYPES.AssignmentExpression) target = parent.left;
    return ASTUtils.isIdentifier(target) ? ASTUtils.findVariable(source.getScope(target), target) : null;
}

export function findMemberAssignment(
    node: TSESTree.AssignmentExpression,
    source: TSESLint.SourceCode,
): MemberAssignment | undefined {
    const { left } = node;
    if (left.type !== AST_NODE_TYPES.MemberExpression || !ASTUtils.isIdentifier(left.object)) return undefined;
    const variable = ASTUtils.findVariable(source.getScope(left), left.object);
    const property = ASTUtils.getPropertyName(left);
    return variable === null || property === null ? undefined : { variable, property };
}

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

export function isAlias(node: TSESTree.Node | null, scope: TSESLint.Scope.Scope): boolean {
    if (node === null) return false;
    let value = unwrapExpression(node);
    while (value.type === AST_NODE_TYPES.MemberExpression && !value.computed) value = unwrapExpression(value.object);
    if (value.type !== AST_NODE_TYPES.Identifier) return false;
    const variable = ASTUtils.findVariable(scope, value);
    return (
        variable !== null &&
        variable.defs.length > 0 &&
        variable.references.every(
            (reference) =>
                (!reference.isWrite() || reference.init === true) &&
                !isMemberWrite(getOutermostMember(reference.identifier)),
        )
    );
}
