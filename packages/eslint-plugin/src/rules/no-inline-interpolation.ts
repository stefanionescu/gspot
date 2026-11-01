import { createRule } from '../rule.ts';
import { usesModule, readCalleeName } from '../testing.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    INLINE_MATCHERS,
    INLINE_EXPECT_MODULES,
    INLINE_EXPECT_ORIGINS,
    INLINE_EXPECT_MODIFIERS,
} from '../config/testing.ts';

function isExpectChain(node: TSESTree.Node, source: TSESLint.SourceCode): boolean {
    let value = node;
    while (
        value.type === AST_NODE_TYPES.MemberExpression &&
        INLINE_EXPECT_MODIFIERS.has(ASTUtils.getPropertyName(value) ?? '')
    )
        value = value.object;
    const expect = value.type === AST_NODE_TYPES.CallExpression ? readCalleeName(value.callee, source) : undefined;
    return expect?.name === 'expect' && expect.modifiers.length === 0 && INLINE_EXPECT_ORIGINS.has(expect.module);
}

export const noInlineInterpolation = createRule<[], 'interpolation'>({
    name: 'no-inline-interpolation',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports a template literal with `${}` expressions as the snapshot of `toMatchInlineSnapshot` or `toThrowErrorMatchingInlineSnapshot` on `expect`, in files that use Jest or Vitest.',
            why: 'The runner rewrites an inline snapshot when it updates snapshots, and it drops the expressions. The next update then compares against fixed text that no longer follows the values.',
            fix: 'Write the snapshot as plain text, or assert the changing values with a separate matcher.',
            example:
                '`expect(user).toMatchInlineSnapshot(`{ "id": ${id} }`)` reports `interpolation`. Assert the id with `toHaveProperty`, and snapshot the rest.',
        },
        schema: [],
        messages: { interpolation: 'Remove this interpolation from the inline snapshot.' },
    },
    create(context) {
        if (!usesModule(context, INLINE_EXPECT_MODULES, ['jest', 'vitest'])) return {};
        return {
            'CallExpression[callee.type="MemberExpression"][arguments.length>0]'(
                node: TSESTree.CallExpression & { callee: TSESTree.MemberExpression },
            ) {
                const inline = node.arguments.at(-1);
                const isMatcher = INLINE_MATCHERS.has(ASTUtils.getPropertyName(node.callee) ?? '');
                const isInterpolated = inline?.type === AST_NODE_TYPES.TemplateLiteral && inline.expressions.length > 0;
                if (isMatcher && isInterpolated && isExpectChain(node.callee.object, context.sourceCode))
                    context.report({ node: inline, messageId: 'interpolation' });
            },
        };
    },
});
