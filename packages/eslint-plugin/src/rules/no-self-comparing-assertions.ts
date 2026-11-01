import { createRule } from '../rule.ts';
import { isSameTokens } from '../testing.ts';
import { listImportedModules } from '../packages.ts';
import type { AssertionChain } from '../types/rules.ts';
import { ASTUtils, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function readChain(node: TSESTree.Node): AssertionChain {
    const values: TSESTree.Node[] = [];
    let root = node;
    let hasAssertionProperty = false;
    while (root.type === AST_NODE_TYPES.CallExpression || root.type === AST_NODE_TYPES.MemberExpression) {
        if (root.type === AST_NODE_TYPES.CallExpression) {
            values.unshift(...root.arguments);
            root = root.callee;
        } else {
            hasAssertionProperty ||= ASTUtils.getPropertyName(root) === 'should';
            root = root.object;
        }
    }
    return { values, hasAssertionProperty, root };
}

function listChainArguments(node: TSESTree.Node): TSESTree.Node[] | undefined {
    const { values, hasAssertionProperty, root } = readChain(node);
    const name = ASTUtils.isIdentifier(root) ? root.name : '';
    if (name === 'expect' || name === 'should') return values;
    return hasAssertionProperty ? [root, ...values] : undefined;
}

function listAssertArguments(node: TSESTree.Node): TSESTree.Node[] | undefined {
    if (node.type !== AST_NODE_TYPES.CallExpression || node.callee.type !== AST_NODE_TYPES.MemberExpression)
        return undefined;
    const { object } = node.callee;
    return ASTUtils.isIdentifier(object) && object.name === 'assert' ? node.arguments : undefined;
}

export const noSelfComparingAssertions = createRule<[], 'duplicate'>({
    name: 'no-self-comparing-assertions',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports an argument of a chai `expect`, `should`, or `assert` statement that repeats another argument of the same assertion token for token, in files that import chai. Literals are not reported.',
            why: 'An assertion that compares a value with itself always passes, so it checks nothing about the code.',
            fix: 'Compare the value with the expected result, written out or computed another way.',
            example: '`expect(total).to.equal(total);` reports `duplicate`. Write `expect(total).to.equal(3);`.',
        },
        schema: [],
        messages: { duplicate: 'Replace this argument or its duplicate.' },
    },
    create(context) {
        if (!listImportedModules(context.sourceCode).has('chai')) return {};
        return {
            ExpressionStatement({ expression }) {
                const groups = [listChainArguments(expression), listAssertArguments(expression)];
                for (const values of groups.filter((group) => group !== undefined)) {
                    const copies = values.filter(
                        (value, index) =>
                            value.type !== AST_NODE_TYPES.Literal &&
                            values.slice(index + 1).some((other) => isSameTokens(value, other, context.sourceCode)),
                    );
                    for (const copy of copies) context.report({ node: copy, messageId: 'duplicate' });
                }
            },
        };
    },
});
