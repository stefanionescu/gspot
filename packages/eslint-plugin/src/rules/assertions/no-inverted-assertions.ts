import { AST_NODE_TYPES, ASTUtils, type TSESTree } from '@typescript-eslint/utils';

import { ORDERED_ASSERTIONS, ORDERED_EXPECT_METHODS } from '../../config/assertions/styles.ts';
import { getMemberRoot, isCallOf } from '../../language/syntax.ts';
import { listEnclosingTestCalls } from '../../libraries/testing.ts';
import { createRule } from '../../rule.ts';
import type { OrderedArguments } from '../../types/assertions.ts';

function getAssertArguments(node: TSESTree.CallExpression): OrderedArguments | undefined {
    const { callee } = node;
    const [first, second] = node.arguments;
    if (
        second === undefined ||
        callee.type !== AST_NODE_TYPES.MemberExpression ||
        !ASTUtils.isIdentifier(callee.object)
    )
        return undefined;
    const format = `${callee.object.name}.${ASTUtils.getPropertyName(callee) ?? ''}`;
    const isOrdered = ORDERED_ASSERTIONS.has(format) && first !== undefined;
    return isOrdered ? { first, second, format: `${format}(actual, expected)` } : undefined;
}

function getExpectArguments(node: TSESTree.CallExpression): OrderedArguments | undefined {
    if (node.callee.type !== AST_NODE_TYPES.MemberExpression) return undefined;
    const method = ASTUtils.getPropertyName(node.callee) ?? '';
    const value = getMemberRoot(node.callee.object);
    const [first] = isCallOf(value, 'expect') ? value.arguments : [];
    const [second] = node.arguments;
    const isOrdered = ORDERED_EXPECT_METHODS.has(method) && first !== undefined && second !== undefined;
    return isOrdered ? { first, second, format: `expect(actual).to.${method}(expected)` } : undefined;
}

export const noInvertedAssertions = createRule<[], 'swap' | 'swapArguments'>({
    name: 'no-inverted-assertions',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        hasSuggestions: true,
        docs: {
            level: 'recommended',
            description:
                'Reports an assertion inside an `it`, `specify`, or `test` case whose actual value is a literal while its expected value is not: `assert.equal`, `strictEqual`, `deepEqual`, `closeTo`, and their negations, `expect(actual).to.equal`, `eql`, and `closeTo`, and `fail` on `assert`, `expect`, and `should`.',
            why: 'A failure message names the expected and the actual value. With the arguments swapped, it shows the code result as the expected value and misleads the reader.',
            fix: 'Pass the value that the code computes first and the literal it should equal second.',
            example: '`assert.equal(3, total)` reports `swap`. Write `assert.equal(total, 3)`.',
        },
        schema: [],
        messages: {
            swap: 'Swap these 2 arguments so they are in the correct order: {{format}}.',
            swapArguments: 'Swap the arguments.',
        },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            CallExpression(node) {
                const ordered = getAssertArguments(node) ?? getExpectArguments(node);
                const isInverted =
                    ordered?.first.type === AST_NODE_TYPES.Literal && ordered.second.type !== AST_NODE_TYPES.Literal;
                const isInsideTest = listEnclosingTestCalls(node, source).some(({ kind }) => kind === 'test');
                if (!isInverted || !isInsideTest) return;
                const { first, second, format } = ordered;
                context.report({
                    node: second,
                    messageId: 'swap',
                    data: { format },
                    suggest: [
                        {
                            messageId: 'swapArguments',
                            fix: (fixer) => [
                                fixer.replaceText(first, source.getText(second)),
                                fixer.replaceText(second, source.getText(first)),
                            ],
                        },
                    ],
                });
            },
        };
    },
});
