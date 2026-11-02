import { createRule } from '../../rule.ts';
import { type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function getBooleanLiteral(statement: TSESTree.Statement | undefined): boolean | undefined {
    if (statement?.type !== AST_NODE_TYPES.ReturnStatement) return undefined;
    const value = statement.argument;
    return value?.type === AST_NODE_TYPES.Literal && typeof value.value === 'boolean' ? value.value : undefined;
}

function getBooleanReturn(statement: TSESTree.Statement | undefined): boolean | undefined {
    if (statement?.type !== AST_NODE_TYPES.BlockStatement) return getBooleanLiteral(statement);
    return statement.body.length === 1 ? getBooleanLiteral(statement.body[0]) : undefined;
}

function hasBooleanAlternative(node: TSESTree.IfStatement): boolean {
    if (node.alternate !== null) return getBooleanReturn(node.alternate) !== undefined;
    const { parent } = node;
    if (parent.type !== AST_NODE_TYPES.BlockStatement) return false;
    const index = parent.body.indexOf(node);
    if (
        parent.body
            .slice(0, index)
            .some(
                (statement) =>
                    statement.type === AST_NODE_TYPES.IfStatement &&
                    getBooleanReturn(statement.consequent) !== undefined,
            )
    )
        return false;
    const following = parent.body[index + 1];
    return following?.type === AST_NODE_TYPES.ReturnStatement && getBooleanReturn(following) !== undefined;
}

export const preferBooleanReturn = createRule<[], 'return'>({
    name: 'prefer-boolean-return',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'all',
            description: 'Reports a conditional whose two paths each return a boolean literal.',
            why: 'A direct boolean return makes the result easier to see than two branches.',
            fix: 'Combine the returns into one boolean expression while preserving evaluation and side effects of the condition.',
            example: '`if (ready) return true; else return false;` can return `Boolean(ready)` directly.',
        },
        schema: [],
        messages: { return: 'Use one boolean return while preserving evaluation of the condition.' },
    },
    create(context) {
        return {
            IfStatement(node) {
                if (node.parent.type === AST_NODE_TYPES.IfStatement || getBooleanReturn(node.consequent) === undefined)
                    return;
                if (hasBooleanAlternative(node)) context.report({ node, messageId: 'return' });
            },
        };
    },
});
