import { createRule } from '../../rule.ts';
import { TRANSPOSED_UNARY_OPERATORS } from '../../config/variables.ts';
import { type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function isAssignmentValue(node: TSESTree.UnaryExpression): boolean {
    const { parent } = node;
    if (parent.type === AST_NODE_TYPES.VariableDeclarator) return parent.init === node;
    return parent.type === AST_NODE_TYPES.AssignmentExpression && parent.operator === '=' && parent.right === node;
}

export const noTransposedAssignment = createRule<[], 'operator'>({
    name: 'no-transposed-assignment',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description: 'Reports =+, =- and =! when spacing suggests the operator was transposed.',
            why: 'A unary operator after assignment can replace a value when the author intended an update or comparison.',
            fix: 'Write the intended operator, or put a space after = and keep the unary operator beside its operand.',
            example: '`count =+ increment;` reports a finding. Use `count += increment;` when adding the increment.',
        },
        schema: [],
        messages: {
            operator: 'Check this ={{operator}} sequence. Write the intended operator and make its spacing clear.',
        },
    },
    create(context) {
        return {
            UnaryExpression(node) {
                if (!TRANSPOSED_UNARY_OPERATORS.has(node.operator) || !isAssignmentValue(node)) return;
                const assignment = context.sourceCode.getTokenBefore(node);
                if (
                    assignment?.value !== '=' ||
                    assignment.range[1] !== node.range[0] ||
                    node.argument.range[0] === node.range[0] + 1
                )
                    return;
                context.report({ node, messageId: 'operator', data: { operator: node.operator } });
            },
        };
    },
});
