import { createRule } from '../../rule.ts';
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { COMPARISON_OPERATORS } from '../../config/rules.ts';

export const noNegatedComparison = createRule<[], 'comparison'>({
    name: 'no-negated-comparison',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'all',
            description: 'Reports negation around equality and ordering comparisons.',
            why: 'A reader must interpret the comparison and then reverse its meaning.',
            fix: 'Use the opposite operator when equivalent. Preserve explicit NaN handling for numeric ordering comparisons.',
            example: '`!(first === second)` reports a finding. Use `first !== second`.',
        },
        schema: [],
        messages: {
            comparison: 'Express this comparison directly, preserving its behavior when either operand can be NaN.',
        },
    },
    create(context) {
        return {
            UnaryExpression(node) {
                if (node.operator !== '!') return;
                const condition = node.argument;
                if (condition.type === AST_NODE_TYPES.BinaryExpression && COMPARISON_OPERATORS.has(condition.operator))
                    context.report({ node, messageId: 'comparison' });
            },
        };
    },
});
