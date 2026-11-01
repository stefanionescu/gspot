import { createRule } from '../rule.ts';
import { readTestCall } from '../testing.ts';
import { readLiteralValue } from '../expressions.ts';
import { listImportedModules } from '../packages.ts';
import { type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { MOCHA_CONSTRUCTS, MAXIMUM_TIMER_DELAY, MARKED_TEST_MODIFIERS } from '../config/testing.ts';

export const noOverflowingTestTimeout = createRule<[], 'overflow'>({
    name: 'no-overflowing-test-timeout',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports `this.timeout(value)` inside a Mocha suite, test, or hook when the value is a number above 2147483647, in files that import chai.',
            why: 'Timers take at most 2147483647 milliseconds. A larger timeout overflows, so the test fails at once instead of waiting longer.',
            fix: 'Pass 0 to turn the timeout off, or pass a value of 2147483647 or less.',
            example: '`this.timeout(3000000000)` reports `overflow`. Write `this.timeout(0)` to turn the timeout off.',
        },
        schema: [],
        messages: {
            overflow: 'Set this timeout to 0 to turn it off, or use a value lower than 2147483648.',
        },
    },
    create(context) {
        if (!listImportedModules(context.sourceCode).has('chai')) return {};
        return {
            'CallExpression[callee.object.type="ThisExpression"][callee.property.name="timeout"]'(
                node: TSESTree.CallExpression,
            ) {
                const value = readLiteralValue(node.arguments[0], context.sourceCode);
                const isInsideTest = context.sourceCode.getAncestors(node).some((ancestor) => {
                    const call =
                        ancestor.type === AST_NODE_TYPES.CallExpression
                            ? readTestCall(ancestor, context.sourceCode)
                            : undefined;
                    const isMarked = call?.modifiers.every((modifier) => MARKED_TEST_MODIFIERS.has(modifier)) === true;
                    return isMarked && MOCHA_CONSTRUCTS.has(call.name);
                });
                if (typeof value === 'number' && value > MAXIMUM_TIMER_DELAY && isInsideTest)
                    context.report({ node: node.arguments[0] ?? node, messageId: 'overflow' });
            },
        };
    },
});
