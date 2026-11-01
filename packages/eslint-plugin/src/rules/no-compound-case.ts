import { createRule } from '../rule.ts';
import { type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function hasCompoundCase(node: TSESTree.Expression): boolean {
    if (node.type === AST_NODE_TYPES.SequenceExpression) return true;
    if (node.type !== AST_NODE_TYPES.LogicalExpression) return false;
    let expression: TSESTree.Expression = node;
    while (expression.type === AST_NODE_TYPES.LogicalExpression) {
        if (expression.operator !== '||') return false;
        expression = expression.left;
    }
    return true;
}

export const noCompoundCase = createRule<[], 'cases'>({
    name: 'no-compound-case',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description: 'Reports comma expressions and combined OR values used as one switch case.',
            why: 'A case matches one expression result. Commas and OR operators do not list alternative matches.',
            fix: 'Write separate case labels for each intended match. Keep intentional boolean cases in switch (true).',
            example: 'Use `case "open": case "ready":` instead of `case "open" || "ready":`.',
        },
        schema: [],
        messages: {
            cases: 'Write a separate case label for each intended match instead of combining these expressions.',
        },
    },
    create(context) {
        return {
            SwitchCase: (node) => {
                const condition = node.test;
                if (condition === null || !hasCompoundCase(condition)) return;
                const { discriminant } = node.parent;
                if (
                    condition.type === AST_NODE_TYPES.LogicalExpression &&
                    discriminant.type === AST_NODE_TYPES.Literal &&
                    discriminant.value === true
                )
                    return;
                context.report({ node: condition, messageId: 'cases' });
            },
        };
    },
});
