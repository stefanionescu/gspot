import { createRule } from '../rule.ts';
import { isCallOf, readTestCall } from '../testing.ts';
import type { OrderedArguments } from '../types/rules.ts';
import { MARKED_TEST_MODIFIERS } from '../config/testing.ts';
import { ORDERED_ASSERTIONS, ORDERED_EXPECT_METHODS } from '../config/assertions.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function readAssertArguments(node: TSESTree.CallExpression): OrderedArguments | undefined {
    const { callee } = node;
    const [first, second] = node.arguments;
    if (
        callee.type !== AST_NODE_TYPES.MemberExpression ||
        !ASTUtils.isIdentifier(callee.object) ||
        second === undefined
    )
        return undefined;
    const format = `${callee.object.name}.${ASTUtils.getPropertyName(callee) ?? ''}`;
    const isOrdered = ORDERED_ASSERTIONS.has(format) && first !== undefined;
    return isOrdered ? { first, second, format: `${format}(actual, expected)` } : undefined;
}

function readExpectArguments(node: TSESTree.CallExpression): OrderedArguments | undefined {
    if (node.callee.type !== AST_NODE_TYPES.MemberExpression) return undefined;
    const method = ASTUtils.getPropertyName(node.callee) ?? '';
    let value: TSESTree.Node = node.callee.object;
    while (value.type === AST_NODE_TYPES.MemberExpression) value = value.object;
    const [first] = isCallOf(value, 'expect') ? value.arguments : [];
    const [second] = node.arguments;
    const isOrdered = ORDERED_EXPECT_METHODS.has(method) && first !== undefined && second !== undefined;
    return isOrdered ? { first, second, format: `expect(actual).to.${method}(expected)` } : undefined;
}

function isInsideTest(node: TSESTree.Node, source: TSESLint.SourceCode): boolean {
    return source.getAncestors(node).some((ancestor) => {
        const call = ancestor.type === AST_NODE_TYPES.CallExpression ? readTestCall(ancestor, source) : undefined;
        return call?.kind === 'test' && call.modifiers.every((modifier) => MARKED_TEST_MODIFIERS.has(modifier));
    });
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
                const ordered = readAssertArguments(node) ?? readExpectArguments(node);
                const isInverted =
                    ordered?.first.type === AST_NODE_TYPES.Literal && ordered.second.type !== AST_NODE_TYPES.Literal;
                if (!isInverted || !isInsideTest(node, source)) return;
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
