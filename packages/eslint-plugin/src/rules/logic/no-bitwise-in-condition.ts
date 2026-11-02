import { createRule } from '../../rule.ts';
import type { TypeReader } from '../../types/plugin.ts';
import { getTypes, getTypeCategory } from '../../language/checker.ts';
import { type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { BITWISE_JOINS, BITWISE_OPERATORS } from '../../config/operators.ts';
import { CONDITION_PARENTS, NUMERIC_VALUE_TYPES } from '../../config/rules.ts';

function isNumeric(node: TSESTree.Node, types: TypeReader | undefined): boolean {
    if (types === undefined) return node.type === AST_NODE_TYPES.Literal && NUMERIC_VALUE_TYPES.has(typeof node.value);
    const type = types.get(node);
    const members = type.isUnion() ? type.types : [type];
    return members.some((member) => getTypeCategory(types, member) === 'number');
}

function isConditionTest(node: TSESTree.Node, ancestors: readonly TSESTree.Node[]): boolean {
    const chain = [node, ...ancestors.toReversed()];
    const index = chain.findIndex((ancestor) => CONDITION_PARENTS.has(ancestor.type));
    const parent = chain[index];
    return parent !== undefined && 'test' in parent && Object.is(parent.test, chain[index - 1]);
}

export const noBitwiseInCondition = createRule<[], 'bitwise'>({
    name: 'no-bitwise-in-condition',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'all',
            description:
                'Reports the only `&` or `|` of a file when it joins operands that are not numbers and sits in the test of an if, a loop, or a conditional expression. A file with other bitwise operations passes, because it works with bits on purpose.',
            why: 'A lone `&` or `|` in a condition is usually a mistyped `&&` or `||`, which also skips short-circuit evaluation.',
            fix: 'Write `&&` or `||`. If the bitwise operation is intended, compare its result with a number.',
            example: '`if (isReady & hasData)` reports `bitwise`. Write `if (isReady && hasData)`.',
        },
        schema: [],
        messages: {
            bitwise: 'Check this {{operator}}. The condition probably needs {{operator}}{{operator}}.',
        },
    },
    create(context) {
        const types = getTypes(context);
        let lone: { node: TSESTree.BinaryExpression; ancestors: readonly TSESTree.Node[] } | undefined;
        let hasBitwise = false;
        return {
            BinaryExpression(node) {
                const isLoneJoin = lone === undefined && BITWISE_JOINS.has(node.operator);
                if (isLoneJoin && !isNumeric(node.left, types) && !isNumeric(node.right, types)) {
                    lone = { node, ancestors: context.sourceCode.getAncestors(node) };
                    return;
                }
                if (BITWISE_OPERATORS.has(node.operator)) hasBitwise = true;
            },
            'Program:exit'() {
                if (hasBitwise || lone === undefined || !isConditionTest(lone.node, lone.ancestors)) return;
                context.report({ node: lone.node, messageId: 'bitwise', data: { operator: lone.node.operator } });
            },
        };
    },
});
