import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';

import { COLLECTION_SIZE_MEMBERS, COLLECTION_TYPE_NAMES } from '../../config/collections.ts';
import { getTypes } from '../../language/checker.ts';
import { createRule } from '../../rule.ts';

function getCollectionSize(node: TSESTree.BinaryExpression): TSESTree.MemberExpression | undefined {
    if (node.operator !== '<' && node.operator !== '>=') return undefined;
    if (
        node.right.type !== AST_NODE_TYPES.Literal ||
        node.right.value !== 0 ||
        node.left.type !== AST_NODE_TYPES.MemberExpression
    )
        return undefined;
    const { property } = node.left;
    return property.type === AST_NODE_TYPES.Identifier && COLLECTION_SIZE_MEMBERS.has(property.name)
        ? node.left
        : undefined;
}

export const noImpossibleCollectionSize = createRule<[], 'comparison'>({
    name: 'no-impossible-collection-size',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description: 'Reports collection length or size comparisons below zero or greater than or equal to zero.',
            why: 'A collection size cannot be negative, so these comparisons cannot distinguish empty and nonempty collections.',
            fix: 'Compare the size with zero using === for emptiness or > for a nonempty collection.',
            example: '`items.length < 0` reports a finding. Use `items.length === 0` to test an empty array.',
        },
        schema: [],
        messages: { comparison: 'A collection size cannot be negative. Use === 0 for empty or > 0 for nonempty.' },
    },
    create(context) {
        const types = getTypes(context);
        return {
            BinaryExpression(node) {
                const size = getCollectionSize(node);
                if (size === undefined) return;
                if (types !== undefined) {
                    const symbol = types.get(size.object).getSymbol();
                    if (symbol === undefined || !COLLECTION_TYPE_NAMES.has(symbol.name)) return;
                }
                context.report({ node, messageId: 'comparison' });
            },
        };
    },
});
