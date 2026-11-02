import { createRule } from '../../rule.ts';
import { type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function getDetachedCallToken(
    node: TSESTree.CallExpression,
    first: TSESTree.CallExpressionArgument,
    source: TSESLint.SourceCode,
): TSESTree.Token | undefined {
    const callee = node.typeArguments ?? node.callee;
    const closing = source.getTokensBetween(callee, first).findLast((token) => token.value === ')');
    const previous = closing ?? source.getLastToken(callee);
    const following = source.getTokenAfter(callee, (token) => token.value !== ')');
    return previous === null || following === null || previous.loc.end.line === following.loc.start.line
        ? undefined
        : following;
}

export const noDetachedCall = createRule<[], 'call' | 'template'>({
    name: 'no-detached-call',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports a single-argument call delimiter or tagged template detached from its callee by a line break.',
            why: 'A detached call or template can look like a separate statement even though it still invokes the preceding value.',
            fix: 'Keep the opening call delimiter or template on the same line as its callee. Move intervening comments above the call.',
            example: 'Use `read(value)` instead of placing `(value)` on a new line after `read`.',
        },
        schema: [],
        messages: {
            call: 'Keep the opening call delimiter on the same line as the callee.',
            template: 'Keep the opening template delimiter on the same line as its tag.',
        },
    },
    create(context) {
        return {
            CallExpression: (node) => {
                const [first, ...others] = node.arguments;
                if (node.callee.type === AST_NODE_TYPES.CallExpression || first === undefined || others.length > 0)
                    return;
                const delimiter = getDetachedCallToken(node, first, context.sourceCode);
                if (delimiter !== undefined) context.report({ node, loc: delimiter.loc, messageId: 'call' });
            },
            TaggedTemplateExpression: (node) => {
                const previous = context.sourceCode.getTokenBefore(node.quasi);
                if (previous !== null && previous.loc.end.line !== node.quasi.loc.start.line)
                    context.report({ node: node.quasi, messageId: 'template' });
            },
        };
    },
});
