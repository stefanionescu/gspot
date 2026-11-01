import { createRule } from '../rule.ts';
import { LOOSE_EQUALITY_OPERATORS } from '../config/rules.ts';
import { type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function isRedundantLogicalBoolean(node: TSESTree.Node, expression: TSESTree.LogicalExpression): boolean {
    if (expression.left === node || expression.operator === '&&') return true;
    if (expression.operator !== '||') return false;
    const { parent } = expression;
    return (
        parent.type === AST_NODE_TYPES.IfStatement ||
        (parent.type === AST_NODE_TYPES.ConditionalExpression && parent.test === expression)
    );
}

function isRedundantBoolean(node: TSESTree.Literal): boolean {
    const { parent } = node;
    switch (parent.type) {
        case AST_NODE_TYPES.BinaryExpression: {
            return LOOSE_EQUALITY_OPERATORS.has(parent.operator);
        }
        case AST_NODE_TYPES.UnaryExpression: {
            return parent.operator === '!';
        }
        case AST_NODE_TYPES.LogicalExpression: {
            return isRedundantLogicalBoolean(node, parent);
        }
        default: {
            return false;
        }
    }
}

export const noRedundantBoolean = createRule<[], 'boolean'>({
    name: 'no-redundant-boolean',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'recommended',
            description: 'Reports redundant boolean literals in loose comparisons, negations, and logical expressions.',
            why: 'Boolean literals can hide the intended test or make a branch independent of its condition.',
            fix: 'Express the intended condition directly. Preserve value coercion and calls with side effects.',
            example: '`if (ready || false)` can use `if (ready)`.',
        },
        schema: [],
        messages: { boolean: 'Simplify this boolean operand while preserving coercion and side effects.' },
    },
    create(context) {
        return {
            Literal: (node) => {
                if (typeof node.value === 'boolean' && isRedundantBoolean(node))
                    context.report({ node, messageId: 'boolean' });
            },
        };
    },
});
