import { createRule } from '../rule.ts';
import type { Isolation } from '../types/rules.ts';
import { haveSameTokens, unwrapExpression } from '../syntax.ts';
import { readAssignedValue, readQualifiedName } from '../modules.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    CLONE_ADVICE,
    DEEP_CLONE_NAMES,
    SHALLOW_CLONE_NAMES,
    NESTED_MEMBER_DEPTH,
    STRUCTURED_CLONE_NAME,
} from '../config/collections.ts';

function readMemberRoot(node: TSESTree.Node): TSESTree.Identifier | undefined {
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

function readCloneCall(target: TSESTree.Node, source: TSESLint.SourceCode): TSESTree.CallExpression | undefined {
    const root = readMemberRoot(target);
    const variable = root === undefined ? null : ASTUtils.findVariable(source.getScope(root), root.name);
    const value = variable === null ? undefined : readAssignedValue(variable);
    return value?.type === AST_NODE_TYPES.CallExpression && value.arguments.length === 1 ? value : undefined;
}

function readCloneAdvice(target: TSESTree.Node, source: TSESLint.SourceCode): string | undefined {
    const call = readCloneCall(target, source);
    if (call === undefined || call.arguments[0]?.type === AST_NODE_TYPES.SpreadElement) return undefined;
    return CLONE_ADVICE.get(readQualifiedName(call.callee, source));
}

function readFreshIsolation(node: TSESTree.Node, source: TSESLint.SourceCode): Isolation {
    const value = unwrapExpression(node);
    if (value.type === AST_NODE_TYPES.ObjectExpression || value.type === AST_NODE_TYPES.ArrayExpression)
        return 'shallow';
    if (value.type !== AST_NODE_TYPES.CallExpression) return 'written';
    if (ASTUtils.isIdentifier(value.callee) && value.callee.name === STRUCTURED_CLONE_NAME) return 'deep';
    const name = readQualifiedName(value.callee, source);
    if (DEEP_CLONE_NAMES.has(name)) return 'deep';
    return SHALLOW_CLONE_NAMES.has(name) ? 'shallow' : 'written';
}

function readStatementIsolation(
    statement: TSESTree.Node,
    prefix: TSESTree.Node,
    source: TSESLint.SourceCode,
): Isolation | undefined {
    const value = statement.type === AST_NODE_TYPES.ExpressionStatement ? statement.expression : undefined;
    if (value?.type !== AST_NODE_TYPES.AssignmentExpression) return undefined;
    if (!haveSameTokens(unwrapExpression(value.left), prefix, source)) return undefined;
    return value.operator === '=' ? readFreshIsolation(value.right, source) : 'written';
}

function readPriorIsolation(
    child: TSESTree.Node,
    prefix: TSESTree.Node,
    source: TSESLint.SourceCode,
): Isolation | undefined {
    const { parent } = child;
    const isBlock = parent?.type === AST_NODE_TYPES.BlockStatement || parent?.type === AST_NODE_TYPES.Program;
    const statements: readonly TSESTree.Node[] = isBlock ? parent.body : [];
    return statements
        .slice(
            0,
            statements.findIndex((statement) => Object.is(statement, child)),
        )
        .map((statement) => readStatementIsolation(statement, prefix, source))
        .findLast((isolation) => isolation !== undefined);
}

function readDominatingIsolation(
    prefix: TSESTree.Node,
    mutation: TSESTree.Node,
    source: TSESLint.SourceCode,
): Isolation | undefined {
    const ancestors = source.getAncestors(mutation);
    const chain = [...ancestors.slice(ancestors.findLastIndex((node) => ASTUtils.isFunction(node)) + 1), mutation];
    return chain
        .map((child) => readPriorIsolation(child, prefix, source))
        .findLast((isolation) => isolation !== undefined);
}

function hasIsolatedPrefix(target: TSESTree.Node, mutation: TSESTree.Node, source: TSESLint.SourceCode): boolean {
    let prefix = unwrapExpression(target);
    let depth = 0;
    while (prefix.type === AST_NODE_TYPES.MemberExpression) {
        const isolation = readDominatingIsolation(prefix, mutation, source);
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
                'Reports a write, an update, or a `delete` of a nested property, two or more static members deep, of a variable whose only value comes from `clone` of lodash, lodash-es, or underscore. An earlier assignment in the same function that replaces the parent object with a fresh object or a deep clone does not count.',
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
        return {
            'AssignmentExpression, UpdateExpression, UnaryExpression[operator="delete"]'(
                mutation: TSESTree.AssignmentExpression | TSESTree.UpdateExpression | TSESTree.UnaryExpression,
            ) {
                const target =
                    mutation.type === AST_NODE_TYPES.AssignmentExpression ? mutation.left : mutation.argument;
                const advice = readCloneAdvice(target, source);
                if (advice !== undefined && !hasIsolatedPrefix(target, mutation, source))
                    context.report({ node: mutation, messageId: 'shared', data: { advice } });
            },
        };
    },
});
