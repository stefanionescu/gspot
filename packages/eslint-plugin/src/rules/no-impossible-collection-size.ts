import { createRule } from '../rule.ts';
import { COLLECTION_TYPE_NAMES, COLLECTION_SIZE_MEMBERS } from '../config/rules.ts';
import { ESLintUtils, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function readCollectionSize(node: TSESTree.BinaryExpression): TSESTree.MemberExpression | undefined {
    if (node.operator !== '<' && node.operator !== '>=') return undefined;
    if (node.right.type !== AST_NODE_TYPES.Literal || node.right.value !== 0) return undefined;
    if (node.left.type !== AST_NODE_TYPES.MemberExpression) return undefined;
    const { property } = node.left;
    if (property.type !== AST_NODE_TYPES.Identifier || !COLLECTION_SIZE_MEMBERS.has(property.name)) return undefined;
    return node.left;
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
        const services = context.sourceCode.parserServices?.program
            ? ESLintUtils.getParserServices(context)
            : undefined;
        return {
            BinaryExpression(node) {
                const size = readCollectionSize(node);
                if (size === undefined) return;
                if (services !== undefined) {
                    const symbol = services.getTypeAtLocation(size.object).getSymbol();
                    if (symbol === undefined || !COLLECTION_TYPE_NAMES.has(symbol.name)) return;
                }
                context.report({ node, messageId: 'comparison' });
            },
        };
    },
});
