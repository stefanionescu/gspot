import { createRule } from '../../rule.ts';
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { ARRAY_PROTOTYPE_NAMES } from '../../config/builtins.ts';
import { getTypes, getTypeCategory } from '../../language/checker.ts';

export const noInMisuse = createRule<[], 'misuse'>({
    name: 'no-in-misuse',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports `in` with an array on its right side, when the left side is not a number and not a quoted array method name. It needs type information and reports nothing without it.',
            why: '`in` tests indexes and property names, not values, so `"b" in ["a", "b"]` is false.',
            fix: 'Use `includes` to test for a value: `items.includes(value)`.',
            example: '`if (name in names)` reports `misuse`. Write `if (names.includes(name))`.',
        },
        schema: [],
        messages: { misuse: '`in` tests array indexes, not values. Use includes instead.' },
    },
    create(context) {
        const types = getTypes(context);
        if (types === undefined) return {};
        return {
            BinaryExpression(node) {
                const { left, right, operator } = node;
                if (operator !== 'in' || getTypeCategory(types, types.get(right)) !== 'array') return;
                if (left.type === AST_NODE_TYPES.Literal && ARRAY_PROTOTYPE_NAMES.has(String(left.value))) return;
                if (getTypeCategory(types, types.get(left)) === 'number') return;
                context.report({ node, messageId: 'misuse' });
            },
        };
    },
});
