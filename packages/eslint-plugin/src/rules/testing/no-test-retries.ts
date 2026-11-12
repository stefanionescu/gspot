import { AST_NODE_TYPES, ASTUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

import { RETRY_MODULES } from '../../config/testing.ts';
import { isModuleUsed } from '../../language/packages.ts';
import { listEnclosingTestCalls } from '../../libraries/testing.ts';
import { createRule } from '../../rule.ts';

function getJestOrigin(node: TSESTree.Node, source: TSESLint.SourceCode): string | undefined {
    if (node.type !== AST_NODE_TYPES.Identifier || node.name !== 'jest') return undefined;
    const variable = ASTUtils.findVariable(source.getScope(node), node);
    const [definition] = variable?.defs ?? [];
    if (definition === undefined) return 'global';
    return definition.parent?.type === AST_NODE_TYPES.ImportDeclaration ? definition.parent.source.value : undefined;
}

export const noTestRetries = createRule<[], 'retry'>({
    name: 'no-test-retries',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'recommended',
            description:
                'Reports `jest.retryTimes()` in files that use Jest, and `this.retries()` inside a Mocha `describe` or `context` suite.',
            why: 'A retry turns a flaky test green without fixing why it fails, so a real race or leak stays in the code.',
            fix: 'Find why the test fails on the first try and fix the test or the code. Delete a test that cannot be made stable.',
            example: '`jest.retryTimes(3);` reports `retry`. Make the test pass on its first run, and delete the call.',
        },
        schema: [],
        messages: { retry: 'Make your tests stable so that they pass on the first try, or remove the flaky ones.' },
    },
    create(context) {
        const isJestUsed = isModuleUsed(context, RETRY_MODULES, ['jest']);
        const source = context.sourceCode;
        return {
            'CallExpression[callee.type="MemberExpression"][callee.property.name="retryTimes"]'(
                node: TSESTree.CallExpression & { callee: TSESTree.MemberExpression },
            ) {
                const origin = getJestOrigin(node.callee.object, source);
                const isJest = origin === '@jest/globals' || (origin === 'global' && isJestUsed);
                if (isJest) context.report({ node, messageId: 'retry' });
            },
            'CallExpression[callee.object.type="ThisExpression"][callee.property.name="retries"]'(
                node: TSESTree.CallExpression,
            ) {
                const isInSuite = listEnclosingTestCalls(node, source).some(
                    ({ name }) => name === 'describe' || name === 'context',
                );
                if (isInSuite) context.report({ node, messageId: 'retry' });
            },
        };
    },
});
