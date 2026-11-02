import { createRule } from '../../rule.ts';
import { traceRegex } from '../../language/regex.ts';
import type { GroupRead } from '../../types/rules.ts';
import { unwrapExpression } from '../../language/syntax.ts';
import { type AST, visitRegExpAST } from '@eslint-community/regexpp';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { EXEC_METHOD, MATCH_METHODS, GROUPS_PROPERTY, INDICES_PROPERTY } from '../../config/regex.ts';

function getCalledMethod(value: TSESTree.Node | null) {
    const call = value === null ? undefined : unwrapExpression(value);
    if (call?.type !== AST_NODE_TYPES.CallExpression || call.callee.type !== AST_NODE_TYPES.MemberExpression)
        return undefined;
    return { call, receiver: call.callee.object, method: ASTUtils.getPropertyName(call.callee) };
}

function getMatchedRegex(value: TSESTree.Node | null, source: TSESLint.SourceCode): AST.RegExpLiteral | undefined {
    const called = getCalledMethod(value);
    if (called?.method === EXEC_METHOD) return traceRegex(called.receiver, source);
    const [pattern] = called !== undefined && MATCH_METHODS.has(called.method) ? called.call.arguments : [];
    return pattern === undefined ? undefined : traceRegex(pattern, source);
}

function getGroupNames(regex: AST.RegExpLiteral): Set<string> {
    const names = new Set<string>();
    visitRegExpAST(regex, {
        onCapturingGroupEnter: (group) => {
            if (group.name !== null) names.add(group.name);
        },
    });
    return names;
}

function getTarget(reader: TSESTree.Node): TSESTree.Node | undefined {
    const { parent } = reader;
    if (parent?.type === AST_NODE_TYPES.VariableDeclarator) return parent.id;
    return parent?.type === AST_NODE_TYPES.AssignmentExpression ? parent.left : undefined;
}

function listDestructuredNames(reader: TSESTree.Node): GroupRead[] {
    const target = getTarget(reader);
    if (target?.type !== AST_NODE_TYPES.ObjectPattern) return [];
    return target.properties.flatMap((property) => {
        const name = property.type === AST_NODE_TYPES.Property ? ASTUtils.getPropertyName(property) : null;
        return name === null || property.type !== AST_NODE_TYPES.Property ? [] : [{ node: property.key, name }];
    });
}

function listReadNames(groups: TSESTree.MemberExpression): GroupRead[] {
    let reader: TSESTree.Node = groups;
    while (reader.parent.type === AST_NODE_TYPES.TSNonNullExpression) reader = reader.parent;
    const { parent } = reader;
    if (parent.type !== AST_NODE_TYPES.MemberExpression || parent.object !== reader)
        return listDestructuredNames(reader);
    const name = ASTUtils.getPropertyName(parent);
    return name === null ? [] : [{ node: parent.property, name }];
}

function getOwner(groups: TSESTree.MemberExpression): TSESTree.Node {
    const owner = unwrapExpression(groups.object);
    const isIndices =
        owner.type === AST_NODE_TYPES.MemberExpression && ASTUtils.getPropertyName(owner) === INDICES_PROPERTY;
    return isIndices ? unwrapExpression(owner.object) : owner;
}

export const noUnknownRegexGroup = createRule<[], 'unknown'>({
    name: 'no-unknown-regex-group',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports a read of `groups.name` or `indices.groups.name`, or a destructured name of `groups`, on the result of `exec`, `match`, or `matchAll` when the regular expression has no capturing group of that name. The result must sit in a variable, and the regular expression must be a literal or a variable with one known value.',
            why: 'A missing group name reads `undefined`, usually because the name has a typo or the group was renamed.',
            fix: 'Read a group name that the regular expression defines, or add the named group.',
            example: '`const date = /(?<year>\\d+)/u.exec(text); date?.groups?.day;` reports `unknown`.',
        },
        schema: [],
        messages: { unknown: 'The regular expression has no group named {{name}}.' },
    },
    create(context) {
        const source = context.sourceCode;
        const matches = new Map<TSESLint.Scope.Variable, Set<string>>();
        const record = (target: TSESTree.Node, value: TSESTree.Node | null) => {
            const regex = getMatchedRegex(value, source);
            const variable = ASTUtils.isIdentifier(target)
                ? ASTUtils.findVariable(source.getScope(target), target)
                : null;
            if (regex !== undefined && variable !== null) matches.set(variable, getGroupNames(regex));
        };
        return {
            VariableDeclarator: (node) => {
                record(node.id, node.init);
            },
            'AssignmentExpression[operator="="]': (node: TSESTree.AssignmentExpression) => {
                record(node.left, node.right);
            },
            MemberExpression(node) {
                const owner = ASTUtils.getPropertyName(node) === GROUPS_PROPERTY ? getOwner(node) : undefined;
                const variable = ASTUtils.isIdentifier(owner)
                    ? ASTUtils.findVariable(source.getScope(owner), owner)
                    : null;
                const names = variable === null ? undefined : matches.get(variable);
                if (names === undefined) return;
                for (const { node: reader, name } of listReadNames(node))
                    if (!names.has(name)) context.report({ node: reader, messageId: 'unknown', data: { name } });
            },
        };
    },
});
