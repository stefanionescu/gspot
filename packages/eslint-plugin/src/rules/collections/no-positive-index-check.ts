import { createRule } from '../../rule.ts';
import { INDEX_OF_METHOD } from '../../config/builtins.ts';
import { getTypes, getTypeCategory } from '../../language/checker.ts';
import { ASTUtils, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function getSearchedArray({ left, right, operator }: TSESTree.BinaryExpression): TSESTree.Node | undefined {
    if (operator !== '>' || right.type !== AST_NODE_TYPES.Literal || right.value !== 0) return undefined;
    if (left.type !== AST_NODE_TYPES.CallExpression || left.arguments.length !== 1) return undefined;
    const { callee } = left;
    const isIndexOf =
        callee.type === AST_NODE_TYPES.MemberExpression && ASTUtils.getPropertyName(callee) === INDEX_OF_METHOD;
    return isIndexOf ? callee.object : undefined;
}

export const noPositiveIndexCheck = createRule<[], 'positive'>({
    name: 'no-positive-index-check',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports `array.indexOf(value) > 0` on an array. It needs type information and reports nothing without it.',
            why: '`indexOf` returns 0 for the first element, so `> 0` misses a value at the start of the array.',
            fix: 'Use `array.includes(value)`, or compare with `>= 0` or `!== -1`.',
            example: '`if (roles.indexOf(role) > 0)` reports `positive`. Write `if (roles.includes(role))`.',
        },
        schema: [],
        messages: { positive: 'This check misses index 0. Use includes, or compare with >= 0.' },
    },
    create(context) {
        const types = getTypes(context);
        if (types === undefined) return {};
        return {
            BinaryExpression(node) {
                const searched = getSearchedArray(node);
                if (searched === undefined || getTypeCategory(types, types.get(searched)) !== 'array') return;
                context.report({ node, messageId: 'positive' });
            },
        };
    },
});
