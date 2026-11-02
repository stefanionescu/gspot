import { createRule } from '../../rule.ts';
import type { Isolation } from '../../types/rules.ts';
import { haveSameTokens, unwrapExpression } from '../../language/syntax.ts';
import { getAssignedValue, getQualifiedName } from '../../language/modules.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    CLONE_ADVICE,
    MUTATING_CALL,
    DEEP_CLONE_NAMES,
    NESTED_MEMBER_DEPTH,
    SHALLOW_CLONE_NAMES,
    STRUCTURED_CLONE_NAME,
} from '../../config/libraries.ts';

function getMemberRoot(node: TSESTree.Node): TSESTree.Identifier | undefined {
    let value = unwrapExpression(node);
    let depth = 0;
    while (value.type === AST_NODE_TYPES.MemberExpression) {
        const isStatic = value.property.type === (value.computed ? AST_NODE_TYPES.Literal : AST_NODE_TYPES.Identifier);
        if (!isStatic) return undefined;
        depth += 1;
        value = unwrapExpression(value.object);
    }
    return ASTUtils.isIdentifier(value) && depth >= NESTED_MEMBER_DEPTH ? value : undefined;
}

function getCloneCall(target: TSESTree.Node, source: TSESLint.SourceCode): TSESTree.CallExpression | undefined {
    const root = getMemberRoot(target);
    const variable = root === undefined ? null : ASTUtils.findVariable(source.getScope(root), root.name);
    const value = variable === null ? undefined : getAssignedValue(variable);
    return value?.type === AST_NODE_TYPES.CallExpression && value.arguments.length === 1 ? value : undefined;
}

function getCloneAdvice(target: TSESTree.Node, source: TSESLint.SourceCode): string | undefined {
    const call = getCloneCall(target, source);
    if (call === undefined || call.arguments[0]?.type === AST_NODE_TYPES.SpreadElement) return undefined;
    return CLONE_ADVICE.get(getQualifiedName(call.callee, source));
}

function getFreshIsolation(node: TSESTree.Node, source: TSESLint.SourceCode): Isolation {
    const value = unwrapExpression(node);
    if (value.type === AST_NODE_TYPES.ObjectExpression || value.type === AST_NODE_TYPES.ArrayExpression)
        return 'shallow';
    if (value.type !== AST_NODE_TYPES.CallExpression) return 'written';
    if (ASTUtils.isIdentifier(value.callee) && value.callee.name === STRUCTURED_CLONE_NAME) return 'deep';
    const name = getQualifiedName(value.callee, source);
    if (DEEP_CLONE_NAMES.has(name)) return 'deep';
    return SHALLOW_CLONE_NAMES.has(name) ? 'shallow' : 'written';
}

function getStatementIsolation(
    statement: TSESTree.Node,
    prefix: TSESTree.Node,
    source: TSESLint.SourceCode,
): Isolation | undefined {
    const value = statement.type === AST_NODE_TYPES.ExpressionStatement ? statement.expression : undefined;
    if (value?.type !== AST_NODE_TYPES.AssignmentExpression) return undefined;
    if (!haveSameTokens(unwrapExpression(value.left), prefix, source)) return undefined;
    return value.operator === '=' ? getFreshIsolation(value.right, source) : 'written';
}

function getPriorIsolation(
    child: TSESTree.Node,
    prefix: TSESTree.Node,
    source: TSESLint.SourceCode,
): Isolation | undefined {
    const { parent } = child;
    const isBlock = parent?.type === AST_NODE_TYPES.BlockStatement || parent?.type === AST_NODE_TYPES.Program;
    const cases = parent?.type === AST_NODE_TYPES.SwitchCase ? parent.consequent : [];
    const statements: readonly TSESTree.Node[] = isBlock ? parent.body : cases;
    return statements
        .slice(
            0,
            statements.findIndex((statement) => Object.is(statement, child)),
        )
        .map((statement) => getStatementIsolation(statement, prefix, source))
        .findLast((isolation) => isolation !== undefined);
}

function getDominatingIsolation(
    prefix: TSESTree.Node,
    mutation: TSESTree.Node,
    source: TSESLint.SourceCode,
): Isolation | undefined {
    const ancestors = source.getAncestors(mutation);
    const chain = [...ancestors.slice(ancestors.findLastIndex((node) => ASTUtils.isFunction(node)) + 1), mutation];
    return chain
        .map((child) => getPriorIsolation(child, prefix, source))
        .findLast((isolation) => isolation !== undefined);
}

function hasIsolatedPrefix(target: TSESTree.Node, mutation: TSESTree.Node, source: TSESLint.SourceCode): boolean {
    let prefix = unwrapExpression(target);
    let depth = 0;
    while (prefix.type === AST_NODE_TYPES.MemberExpression) {
        const isolation = getDominatingIsolation(prefix, mutation, source);
        if (isolation === 'deep' || (isolation === 'shallow' && depth === 1)) return true;
        depth += 1;
        prefix = unwrapExpression(prefix.object);
    }
    return false;
}

export const noShallowCloneMutation = createRule<[], 'shared'>({
    name: 'no-shallow-clone-mutation',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports a write, an update, a `delete`, or a call of a mutating method such as `push` on a nested property, two or more static members deep, of a variable whose only value comes from `clone` of lodash, lodash-es, or underscore. An earlier assignment in the same function that replaces the parent object with a fresh object or a deep clone does not count.',
            why: 'A shallow clone shares its nested objects with the original, so a change to a nested property changes the original value too.',
            fix: 'Copy with `structuredClone()` or `_.cloneDeep()` when the copy needs its own nested values, or replace the parent object before the write.',
            example: '`const copy = _.clone(settings); copy.theme.color = "red";` reports `shared`.',
        },
        schema: [],
        messages: {
            shared: 'The shallow clone shares this nested property with the original value. Use {{advice}} to copy it.',
        },
    },
    create(context) {
        const source = context.sourceCode;
        const inspect = (mutation: TSESTree.Node, target: TSESTree.Node) => {
            const advice = getCloneAdvice(target, source);
            if (advice !== undefined && !hasIsolatedPrefix(target, mutation, source))
                context.report({ node: mutation, messageId: 'shared', data: { advice } });
        };
        return {
            'AssignmentExpression, UpdateExpression, UnaryExpression[operator="delete"]': (
                mutation: TSESTree.AssignmentExpression | TSESTree.UpdateExpression | TSESTree.UnaryExpression,
            ) => {
                inspect(
                    mutation,
                    mutation.type === AST_NODE_TYPES.AssignmentExpression ? mutation.left : mutation.argument,
                );
            },
            [MUTATING_CALL]: (mutation: TSESTree.CallExpression) => {
                inspect(mutation, mutation.callee);
            },
        };
    },
});
