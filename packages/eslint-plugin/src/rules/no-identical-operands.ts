import { createRule } from '../rule.ts';
import { type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { UNIT_SHIFT_VALUES, EQUALITY_OPERATORS, REPEATED_OPERATORS } from '../config/rules.ts';

function isComparedOperator(node: TSESTree.BinaryExpression | TSESTree.LogicalExpression): boolean {
    const { left, right, operator } = node;
    if (operator === '<<' && left.type === AST_NODE_TYPES.Literal) return !UNIT_SHIFT_VALUES.has(left.value);
    if (REPEATED_OPERATORS.has(operator)) return true;
    return (
        EQUALITY_OPERATORS.has(operator) &&
        (left.type !== AST_NODE_TYPES.Identifier || right.type !== AST_NODE_TYPES.Identifier)
    );
}

function hasRepeatedOperands(
    node: TSESTree.BinaryExpression | TSESTree.LogicalExpression,
    source: TSESLint.SourceCode,
): boolean {
    const { left, right } = node;
    if (left.type !== right.type || !isComparedOperator(node)) return false;
    const leftTokens = source.getTokens(left);
    const rightTokens = source.getTokens(right);
    return (
        leftTokens.length === rightTokens.length &&
        leftTokens.every((token, index) => token.value === rightTokens[index]?.value)
    );
}

export const noIdenticalOperands = createRule<[], 'operands'>({
    name: 'no-identical-operands',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports identical operands in comparisons, logical expressions, subtraction, division and shifts.',
            why: 'Repeating the same operand often means one side refers to the wrong value.',
            fix: 'Check both operands and replace the unintended repetition with the correct value.',
            example: '`total - total` reports a finding. Check whether one operand should be the previous total.',
        },
        schema: [],
        messages: { operands: 'Both operands of {{operator}} are identical. Check which value each side should use.' },
    },
    create(context) {
        const inspect = (node: TSESTree.BinaryExpression | TSESTree.LogicalExpression) => {
            const repeated = hasRepeatedOperands(node, context.sourceCode);
            if (!repeated) return;
            context.report({ node, messageId: 'operands', data: { operator: node.operator } });
        };
        return { BinaryExpression: inspect, LogicalExpression: inspect };
    },
});
