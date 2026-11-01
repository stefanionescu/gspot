import { createRule } from '../rule.ts';
import type { Isolation } from '../types/rules.ts';
import { TYPE_ASSERTION_NODES } from '../config/plugin.ts';
import { listChildren, haveSameTokens } from '../syntax.ts';
import { readModuleName, readAssignedValue } from '../modules.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    CLONE_ADVICE,
    DEEP_CLONE_NAMES,
    STATIC_KEY_TYPES,
    NODE_MODULE_PREFIX,
    SHALLOW_CLONE_NAMES,
    NESTED_MEMBER_DEPTH,
    STRUCTURED_CLONE_NAME,
} from '../config/collections.ts';

const isTypeAssertion = ASTUtils.isNodeOfTypes(TYPE_ASSERTION_NODES.map((type) => AST_NODE_TYPES[type]));

function unwrapAssertion(node: TSESTree.Node): TSESTree.Node {
    let value = node;
    while (isTypeAssertion(value)) value = value.expression;
    return value;
}

function readWriteTarget(node: TSESTree.Node): TSESTree.Node | undefined {
    if (node.type === AST_NODE_TYPES.AssignmentExpression) return node.left;
    if (node.type === AST_NODE_TYPES.UpdateExpression) return node.argument;
    return node.type === AST_NODE_TYPES.UnaryExpression && node.operator === 'delete' ? node.argument : undefined;
}

function isStaticMember(member: TSESTree.MemberExpression): boolean {
    const { property, computed } = member;
    if (!computed) return property.type === AST_NODE_TYPES.Identifier;
    return property.type === AST_NODE_TYPES.Literal && STATIC_KEY_TYPES.has(typeof property.value);
}

function readMemberRoot(node: TSESTree.Node): TSESTree.Identifier | undefined {
    let value = unwrapAssertion(node);
    let depth = 0;
    while (value.type === AST_NODE_TYPES.MemberExpression) {
        if (!isStaticMember(value)) return undefined;
        depth += 1;
        value = unwrapAssertion(value.object);
    }
    return ASTUtils.isIdentifier(value) && depth >= NESTED_MEMBER_DEPTH ? value : undefined;
}

function readQualifiedName(node: TSESTree.Node, source: TSESLint.SourceCode): string {
    const name = readModuleName(node, source) ?? '';
    const local = name.replace(NODE_MODULE_PREFIX, '');
    return local.replaceAll('/', '.');
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

function readRootVariable(node: TSESTree.Node, source: TSESLint.SourceCode): TSESLint.Scope.Variable | undefined {
    let value = node;
    while (value.type === AST_NODE_TYPES.MemberExpression) value = unwrapAssertion(value.object);
    if (!ASTUtils.isIdentifier(value)) return undefined;
    return ASTUtils.findVariable(source.getScope(value), value.name) ?? undefined;
}

function isSameMember(left: TSESTree.Node, prefix: TSESTree.Node, source: TSESLint.SourceCode): boolean {
    const first = unwrapAssertion(left);
    const second = unwrapAssertion(prefix);
    if (!haveSameTokens(first, second, source)) return false;
    const variable = readRootVariable(first, source);
    return variable !== undefined && Object.is(variable, readRootVariable(second, source));
}

function containsWrite(node: TSESTree.Node, prefix: TSESTree.Node, source: TSESLint.SourceCode): boolean {
    const value = unwrapAssertion(node);
    if (ASTUtils.isFunction(value)) return false;
    const target = readWriteTarget(value);
    if (target !== undefined && isSameMember(target, prefix, source)) return true;
    return listChildren(value, source.visitorKeys).some((child) => containsWrite(child, prefix, source));
}

function readFreshIsolation(node: TSESTree.Node, source: TSESLint.SourceCode): Isolation {
    const value = unwrapAssertion(node);
    if (value.type === AST_NODE_TYPES.ObjectExpression || value.type === AST_NODE_TYPES.ArrayExpression)
        return 'shallow';
    if (value.type !== AST_NODE_TYPES.CallExpression) return 'written';
    if (ASTUtils.isIdentifier(value.callee) && value.callee.name === STRUCTURED_CLONE_NAME) return 'deep';
    const name = readQualifiedName(value.callee, source);
    if (DEEP_CLONE_NAMES.has(name)) return 'deep';
    return SHALLOW_CLONE_NAMES.has(name) ? 'shallow' : 'written';
}

function readExpressionIsolation(
    node: TSESTree.Node,
    prefix: TSESTree.Node,
    source: TSESLint.SourceCode,
): Isolation | undefined {
    const value = unwrapAssertion(node);
    if (value.type === AST_NODE_TYPES.SequenceExpression)
        return value.expressions
            .map((expression) => readExpressionIsolation(expression, prefix, source))
            .findLast((isolation) => isolation !== undefined);
    if (value.type === AST_NODE_TYPES.AssignmentExpression && isSameMember(value.left, prefix, source))
        return value.operator === '=' ? readFreshIsolation(value.right, source) : 'written';
    const checked = value.type === AST_NODE_TYPES.AssignmentExpression ? value.right : value;
    return containsWrite(checked, prefix, source) ? 'written' : undefined;
}

function readStatementIsolation(
    node: TSESTree.Node,
    prefix: TSESTree.Node,
    source: TSESLint.SourceCode,
): Isolation | undefined {
    if (node.type === AST_NODE_TYPES.ExpressionStatement)
        return readExpressionIsolation(node.expression, prefix, source);
    if (node.type === AST_NODE_TYPES.LabeledStatement) return readStatementIsolation(node.body, prefix, source);
    if (node.type !== AST_NODE_TYPES.BlockStatement) return containsWrite(node, prefix, source) ? 'written' : undefined;
    return node.body
        .map((statement) => readStatementIsolation(statement, prefix, source))
        .findLast((isolation) => isolation !== undefined);
}

function listBlockStatements(parent: TSESTree.Node): readonly TSESTree.Node[] {
    if (parent.type === AST_NODE_TYPES.SwitchCase) return parent.consequent;
    const isBlock = parent.type === AST_NODE_TYPES.BlockStatement || parent.type === AST_NODE_TYPES.Program;
    return isBlock ? parent.body : [];
}

function readPriorIsolation(
    parent: TSESTree.Node,
    child: TSESTree.Node,
    prefix: TSESTree.Node,
    source: TSESLint.SourceCode,
): Isolation | undefined {
    if (parent.type === AST_NODE_TYPES.SequenceExpression) {
        const index = parent.expressions.findIndex((expression) => Object.is(expression, child));
        return parent.expressions
            .slice(0, Math.max(index, 0))
            .map((expression) => readExpressionIsolation(expression, prefix, source))
            .findLast((isolation) => isolation !== undefined);
    }
    const statements = listBlockStatements(parent);
    const index = statements.findIndex((statement) => Object.is(statement, child));
    return statements
        .slice(0, Math.max(index, 0))
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
        .slice(1)
        .map((child, index) => {
            const parent = chain[index];
            return parent === undefined ? undefined : readPriorIsolation(parent, child, prefix, source);
        })
        .findLast((isolation) => isolation !== undefined);
}

function hasIsolatedPrefix(target: TSESTree.Node, mutation: TSESTree.Node, source: TSESLint.SourceCode): boolean {
    const member = unwrapAssertion(target);
    let prefix = member.type === AST_NODE_TYPES.MemberExpression ? unwrapAssertion(member.object) : undefined;
    let depth = 1;
    while (prefix?.type === AST_NODE_TYPES.MemberExpression) {
        const isolation = readDominatingIsolation(prefix, mutation, source);
        if (isolation === 'deep' || (isolation === 'shallow' && depth === 1)) return true;
        depth += 1;
        prefix = unwrapAssertion(prefix.object);
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
        const inspect = (mutation: TSESTree.Node) => {
            const target = readWriteTarget(mutation);
            const advice = target === undefined ? undefined : readCloneAdvice(target, source);
            const isStatement = source
                .getAncestors(mutation)
                .some(({ type }) => type.endsWith('Statement') || type === AST_NODE_TYPES.VariableDeclaration);
            if (target === undefined || advice === undefined || !isStatement) return;
            if (!hasIsolatedPrefix(target, mutation, source))
                context.report({ node: mutation, messageId: 'shared', data: { advice } });
        };
        return {
            AssignmentExpression: inspect,
            UpdateExpression: inspect,
            'UnaryExpression[operator="delete"]': inspect,
        };
    },
});
